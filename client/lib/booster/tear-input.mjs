export const TEAR_THRESHOLD=.82;
export const MIN_TEAR_DRAG=24;
export function canCommitTear({mode,distance,progress}){
 return (mode==='tear'||mode==='keyboard-tear')&&distance>=MIN_TEAR_DRAG&&progress>=TEAR_THRESHOLD;
}
export function tearProgress(dx,dy,viewportWidth){
 return Math.max(0,Math.min(.99,dx/(viewportWidth<700?155:260)+Math.max(0,-dy)/420));
}
