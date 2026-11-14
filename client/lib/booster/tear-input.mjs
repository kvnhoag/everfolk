export const TEAR_THRESHOLD=.82;
export const MIN_TEAR_DRAG=24;
export function canCommitTear({mode,distance,progress}){
 return (mode==='tear'||mode==='keyboard-tear')&&distance>=MIN_TEAR_DRAG&&progress>=TEAR_THRESHOLD;
}
export function localTearDirection(screenDirection,projectedAxis=1){
 return (screenDirection<0?-1:1)*(projectedAxis<0?-1:1);
}
export function tearProgress(dx,dy,viewportWidth,direction=Math.sign(dx)||1){
 return Math.max(0,Math.min(.99,Math.max(0,dx*direction)/(viewportWidth<700?155:260)+Math.max(0,-dy)/420));
}
