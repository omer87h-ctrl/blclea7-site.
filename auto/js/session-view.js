/* Read-only chronological views; neither hardware nor saved data is modified. */
import {EvidenceEngine} from './evidence-engine.js';
export function replayWindow(input,count){
 const engine=new EvidenceEngine();
 const view=JSON.parse(engine.exportSession(input));
 if(!Number.isSafeInteger(count)||count<0||count>view.frames.length)throw Error('Nepodržana pozicija snimka.');
 view.frames=view.frames.slice(0,count);
 if(view.baseline&&(!view.frames.length||view.frames.at(-1).ordinal<view.baseline.throughOrdinal))view.baseline=null;
 engine.exportSession(view);
 return view;
}
