import {grayscaleSlice} from './slice-adapter.js';
self.onmessage=({data})=>{
  try {
    const slices=data.slabs.map(s=>({frame:s.frame,rgba:grayscaleSlice(s)}));
    self.postMessage({revision:data.revision,slices},slices.map(s=>s.rgba.buffer));
  } catch(error) {self.postMessage({revision:data.revision,error:error.message});}
};
