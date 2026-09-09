import {point3} from './space-registry.js';

const axes={axial:[0,1,2],coronal:[0,2,1],sagittal:[1,2,0]};
export const add = (a,b) => a.map((n,i)=>n+b[i]);
export const scale = (a,s) => a.map(n=>n*s);
export const dot = (a,b) => a.reduce((s,n,i)=>s+n*b[i],0);
export const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export function framePoint(frame,u,v) {return add(frame.originMm,add(scale(frame.uMm,u),scale(frame.vMm,v)));}
export function planeDistance(frame,point) {return dot(point.map((n,i)=>n-frame.originMm[i]),frame.normal);}
export function visibleAtPlane(frame,point,direction=1) {return direction*planeDistance(frame,point)>=-1e-6;}

/** origin is the lower pixel edge. Integer native voxel positions are centers.
 * uMm/vMm span the entire image FOV; no canvas zoom, padding or radiological flip.
 */
export function nativeSliceFrame({spaceId,shape,voxelToWorld,voxel,plane,revision=0}) {
  if (!axes[plane] || !point3(voxel) || !shape.every(n=>Number.isInteger(n)&&n>0)) throw new Error('Invalid native slice');
  const [u,v,n]=axes[plane],p=[0,0,0];p[u]=-.5;p[v]=-.5;p[n]=voxel[n];
  const originMm=voxelToWorld(p),up=[...p],vp=[...p];up[u]+=shape[u];vp[v]+=shape[v];
  const uMm=voxelToWorld(up).map((x,i)=>x-originMm[i]),vMm=voxelToWorld(vp).map((x,i)=>x-originMm[i]);
  const normal=cross(uMm,vMm),length=Math.hypot(...normal);
  if (!point3(originMm)||length<1e-8) throw new Error('Degenerate native slice');
  return {spaceId,plane,originMm,uMm,vMm,normal:scale(normal,1/length),width:shape[u],height:shape[v],
    axis:n,uAxis:u,vAxis:v,depth:voxel[n],sampleIndex:Math.max(0,Math.min(shape[n]-1,Math.round(voxel[n]))),
    convention:'voxel-centers; origin-at-pixel-edge; x-fastest; native-RAS-permutation',interpolation:'nearest',revision};
}

/** Copy a single scalar slab in RAS order from NiiVue's original typed array.
 * No volume transfer, detached NiiVue buffers or additional 3D cache.
 */
export function extractNativeSlab(image,frame) {
  const steps=image.img2RASstep, starts=image.img2RASstart;
  if (!steps || !starts || !image.img) throw new Error('Pinned NiiVue native layout unavailable');
  const values=new Float32Array(frame.width*frame.height);
  const start=starts.reduce((a,b)=>a+b,0)+frame.sampleIndex*steps[frame.axis];
  for(let y=0;y<frame.height;y++) {
    let index=start+y*steps[frame.vAxis];
    for(let x=0;x<frame.width;x++,index+=steps[frame.uAxis]) values[y*frame.width+x]=image.img[index];
  }
  const slope=Number.isFinite(image.hdr.scl_slope)&&image.hdr.scl_slope!==0?image.hdr.scl_slope:1;
  const intercept=Number.isFinite(image.hdr.scl_inter)?image.hdr.scl_inter:0;
  return {frame,values,slope,intercept,range:[image.cal_min,image.cal_max]};
}
export function grayscaleSlice({values,slope,intercept,range,frame}) {
  if (!(range[1]>range[0]) || values.length!==frame.width*frame.height) throw new Error('Invalid slice intensity');
  const rgba=new Uint8Array(values.length*4);
  for(let i=0;i<values.length;i++) {
    const intensity=values[i]*slope+intercept;
    const gray=Math.max(0,Math.min(255,Math.round((intensity-range[0])/(range[1]-range[0])*255)));
    rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=gray;rgba[i*4+3]=255;
  }
  return rgba;
}
