// Development-only comparison. Not imported by the learning app.
import * as THREE from 'three';
import {Niivue,NVImage,NVMesh,SHOW_RENDER,MULTIPLANAR_TYPE} from '../vendor/niivue.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {nativeSliceFrame,extractNativeSlab,framePoint,grayscaleSlice} from '../viewer/slice-adapter.js';

const start=performance.now(),heap=()=>performance.memory?.usedJSHeapSize??null;
const report={hardware:{userAgent:navigator.userAgent,cores:navigator.hardwareConcurrency,deviceMemoryGiB:navigator.deviceMemory??null,dpr:devicePixelRatio},heapBefore:heap()};
try{
  const c=await fetch('../assets/cases/sub-01/case.json').then(r=>r.json());
  const volume=await NVImage.loadFromUrl({url:'../'+c.sequences.T1w.url});
  volume.cal_min=c.sequences.T1w.display_range[0];volume.cal_max=c.sequences.T1w.display_range[1];
  const index=await fetch('../assets/packs/subject-core/current.json').then(r=>r.json());
  const pack=await fetch('../'+index.cases[0].url).then(r=>r.json()),rep=pack.representations.find(r=>r.labelId===1);
  const gltf=await new GLTFLoader().loadAsync('../'+rep.mesh.url);
  let geometry;gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(m=>{if(m.isMesh){geometry=m.geometry.clone().applyMatrix4(m.matrixWorld).scale(1000,1000,1000);}});geometry.computeVertexNormals();
  const voxel=Array.from(volume.mm2vox(rep.interiorAnchor,true));
  const frame=nativeSliceFrame({spaceId:pack.space.id,shape:volume.dimsRAS.slice(1,4),voxel,plane:'axial',voxelToWorld:p=>Array.from(volume.vox2mm(p,volume.matRAS))});
  const planeGeometry=new THREE.BufferGeometry();planeGeometry.setAttribute('position',new THREE.Float32BufferAttribute([[0,0],[1,0],[1,1],[0,1]].flatMap(([u,v])=>framePoint(frame,u,v)),3));planeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));planeGeometry.setIndex([0,1,2,0,2,3]);
  function setup(id){
    const renderer=new THREE.WebGLRenderer({canvas:document.getElementById(id),antialias:false,preserveDrawingBuffer:true});renderer.setSize(480,500,false);
    const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(48,480/500,1,1200),center=new THREE.Vector3(...framePoint(frame,.5,.5));
    camera.up.set(0,0,1);camera.position.copy(center).add(new THREE.Vector3(150,200,230));camera.lookAt(center);
    scene.add(new THREE.AmbientLight(0xffffff,2));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(100,100,200);scene.add(light);
    scene.add(new THREE.Mesh(geometry.clone(),new THREE.MeshStandardMaterial({color:'#d4a05c',side:THREE.DoubleSide})));
    return {renderer,scene,camera};
  }
  const slabStart=performance.now(),slab=extractNativeSlab(volume,frame),worker=new Worker(new URL('../viewer/slice-worker.js',import.meta.url),{type:'module'});
  const output=await new Promise((resolve,reject)=>{worker.onmessage=({data})=>data.error?reject(new Error(data.error)):resolve(data.slices[0]);worker.onerror=reject;worker.postMessage({revision:1,slabs:[slab]},[slab.values.buffer]);});worker.terminate();
  const two=setup('slab'),texture=new THREE.DataTexture(output.rgba,frame.width,frame.height,THREE.RGBAFormat);texture.colorSpace=THREE.SRGBColorSpace;texture.needsUpdate=true;
  two.scene.add(new THREE.Mesh(planeGeometry.clone(),new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,toneMapped:false})));
  two.renderer.render(two.scene,two.camera);two.renderer.getContext().finish();
  report.worker2D={firstMs:performance.now()-slabStart,additionalScalarSlabBytes:frame.width*frame.height*4,rgbaBytes:output.rgba.byteLength,gpuTextureBytes:output.rgba.byteLength,heap:heap()};
  const threeStart=performance.now(),three=setup('volume');
  // Signed original int16 array; no 8-bit volume or Float32 conversion.
  const dims=volume.hdr.dims.slice(1,4),texture3D=new THREE.Data3DTexture(volume.img,...dims);
  texture3D.format=THREE.RedIntegerFormat;texture3D.type=THREE.ShortType;texture3D.internalFormat='R16I';texture3D.minFilter=THREE.NearestFilter;texture3D.magFilter=THREE.NearestFilter;texture3D.unpackAlignment=1;texture3D.needsUpdate=true;
  const inverse=new THREE.Matrix4().set(...volume.hdr.affine.flat()).invert();
  const material=new THREE.ShaderMaterial({glslVersion:THREE.GLSL3,side:THREE.DoubleSide,toneMapped:false,uniforms:{scan:{value:texture3D},worldToVoxel:{value:inverse},dims:{value:new THREE.Vector3(...dims)},lo:{value:volume.cal_min},hi:{value:volume.cal_max}},vertexShader:'out vec3 world; void main(){world=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'precision highp isampler3D; uniform isampler3D scan; uniform mat4 worldToVoxel; uniform vec3 dims; uniform float lo; uniform float hi; in vec3 world; out vec4 color; void main(){vec3 v=(worldToVoxel*vec4(world,1.)).xyz;ivec3 i=ivec3(clamp(floor(v+.5),vec3(0.),dims-1.));float f=float(texelFetch(scan,i,0).r);float g=clamp((f-lo)/(hi-lo),0.,1.);color=vec4(g,g,g,1.);}'});
  three.scene.add(new THREE.Mesh(planeGeometry.clone(),material));three.renderer.render(three.scene,three.camera);three.renderer.getContext().finish();
  report.three3D={firstMs:performance.now()-threeStart,additionalCPUVolumeBytes:0,gpuTextureBytes:volume.img.byteLength,format:'R16I, original array reused',heap:heap(),webglError:three.renderer.getContext().getError()};
  const pixelsA=new Uint8Array(480*500*4),pixelsB=new Uint8Array(pixelsA.length);
  two.renderer.getContext().readPixels(0,0,480,500,6408,5121,pixelsA);three.renderer.getContext().readPixels(0,0,480,500,6408,5121,pixelsB);
  let differences=[];for(let i=0;i<pixelsA.length;i+=4)if(pixelsA[i]===pixelsA[i+1]&&pixelsA[i]===pixelsA[i+2]&&pixelsA[i]>15&&pixelsA[i]<240&&pixelsB[i]===pixelsB[i+1])differences.push(Math.abs(pixelsA[i]-pixelsB[i]));
  differences.sort((a,b)=>a-b);report.twoVsThreePixels={samples:differences.length,p95:differences[Math.floor(differences.length*.95)],max:differences.at(-1),above2:differences.filter(d=>d>2).length};
  const niivueStart=performance.now(),nv=new Niivue({backColor:[0,0,0,1],multiplanarShowRender:SHOW_RENDER.ALWAYS,multiplanarLayout:MULTIPLANAR_TYPE.GRID,isRadiologicalConvention:true});
  await nv.attachToCanvas(document.getElementById('niivue'));nv.setInterpolation(true);nv.setSliceMM(true);nv.addVolume(volume);
  nv.addMesh(new NVMesh(geometry.attributes.position.array,geometry.index.array,'sub-01 left hippocampus',new Uint8Array([212,160,92,255]),1,true,nv.gl));
  nv.setSliceType(nv.sliceTypeMultiplanar);nv.scene.crosshairPos=nv.mm2frac(rep.interiorAnchor);nv.drawScene();nv.gl.finish();
  report.niivue={firstMs:performance.now()-niivueStart,meshCount:nv.meshes.length,additionalCPUVolumeBytes:0,volumeArrayBytes:volume.img.byteLength,gpuTextures:'NiiVue-managed; not measured as peak GPU memory',heap:heap(),webglError:nv.gl.getError()};
  // Read actual NiiVue framebuffer brightness at magnified native voxel centers.
  // Keep mesh/crosshair overlays out of this intensity comparison only.
  nv.meshes[0].opacity=0;nv.setSliceType(nv.sliceTypeAxial);nv.setCrosshairWidth(0);nv.setPan2Dxyzmm([0,0,0,3]);nv.drawScene();
  const framebuffer=new Uint8Array(nv.gl.drawingBufferWidth*nv.gl.drawingBufferHeight*4);
  nv.gl.readPixels(0,0,nv.gl.drawingBufferWidth,nv.gl.drawingBufferHeight,nv.gl.RGBA,nv.gl.UNSIGNED_BYTE,framebuffer);
  const screenDiff=[];
  for(let y=30;y<frame.height-30;y+=9)for(let x=30;x<frame.width-30;x+=7){
    const world=framePoint(frame,(x+.5)/frame.width,(y+.5)/frame.height),tile=nv.frac2canvasPosWithTile(nv.mm2frac(world),0);
    if(!tile)continue;
    const px=Math.round(tile.pos[0]),py=Math.round(tile.pos[1]);
    if(px<10||py<10||px>=nv.gl.drawingBufferWidth-10||py>=nv.gl.drawingBufferHeight-10)continue;
    const i=((nv.gl.drawingBufferHeight-1-py)*nv.gl.drawingBufferWidth+px)*4,gray=output.rgba[(y*frame.width+x)*4];
    if(gray<15||gray>240||framebuffer[i]!==framebuffer[i+1]||framebuffer[i]!==framebuffer[i+2])continue;
    screenDiff.push(Math.abs(gray-framebuffer[i]));
  }
  screenDiff.sort((a,b)=>a-b);report.niivueFramebufferVsWorker={samples:screenDiff.length,p95:screenDiff[Math.floor(screenDiff.length*.95)],max:screenDiff.at(-1),above2:screenDiff.filter(d=>d>2).length};
  nv.meshes[0].opacity=1;nv.setPan2Dxyzmm([0,0,0,1]);nv.setCrosshairWidth(1);nv.setSliceType(nv.sliceTypeMultiplanar);nv.drawScene();
  report.frame=frame;report.volumeBytes=volume.img.byteLength;report.totalMs=performance.now()-start;report.complete=true;
  // Exact scalar-window agreement is separate from framebuffer brightness.
  const expectedRGBA=grayscaleSlice(extractNativeSlab(volume,frame));
  report.workerScalarMatches=output.rgba.every((n,i)=>n===expectedRGBA[i]);
  window.rendererProbe=report;document.getElementById('result').textContent=JSON.stringify(report,null,2);
}catch(error){window.rendererProbe={error:error.stack};document.getElementById('result').textContent=error.stack;throw error;}
