import { useEffect, useRef } from 'react';
import { drawMeteor, METEOR_DURATION } from './meteor-scene.ts';

export default function MeteorTransition({ onCovered,onComplete }: {onCovered():void;onComplete():void}) {
  const canvas=useRef<HTMLCanvasElement>(null), skip=useRef<HTMLButtonElement>(null);
  const callbacks=useRef({onCovered,onComplete});callbacks.current={onCovered,onComplete};
  useEffect(()=>{
    const el=canvas.current;if(!el)return;
    const c=el.getContext('2d');if(!c){callbacks.current.onCovered();callbacks.current.onComplete();return;}
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    let cancelled=false,swapped=false,finished=false;
    let cleanup=()=>{};
    // Match the visible viewport so the meteor path stays in-frame on portrait phones.
    const resize=()=>{
      const bounds=el.getBoundingClientRect();
      el.width=Math.max(1,Math.round(480*bounds.width/Math.max(1,bounds.height)));el.height=480;
    };
    resize();window.addEventListener('resize',resize);
    skip.current?.focus({preventScroll:true});
    const finish=()=>{if(finished)return;finished=true;if(!swapped)callbacks.current.onCovered();callbacks.current.onComplete();};
    if(preference.matches){finish();return()=>window.removeEventListener('resize',resize);}
    void import('gsap').then(({gsap})=>{
      if(cancelled)return;
      const host=el.closest<HTMLElement>('.ef-home');
      const context=gsap.context(()=>{
        const clock={time:0};
        const timeline=gsap.timeline({onComplete:finish});
        timeline.to(clock,{time:METEOR_DURATION,duration:METEOR_DURATION,ease:'none',onUpdate:()=>{
          el.dataset.phase=drawMeteor(c,clock.time,el.width,el.height);
          if(clock.time>=6.5&&!swapped){swapped=true;callbacks.current.onCovered();}
        }},0);
        if(host)timeline.to(host,{'--impact-x':'4px','--impact-y':'-2px',duration:.075,repeat:7,yoyo:true,ease:'sine.inOut'},5)
          .set(host,{'--impact-x':'0px','--impact-y':'0px'},5.65);
        const visibility=()=>timeline.paused(document.hidden);
        const reduce=()=>{if(preference.matches)finish();};
        document.addEventListener('visibilitychange',visibility);
        preference.addEventListener('change',reduce);visibility();
        cleanup=()=>{document.removeEventListener('visibilitychange',visibility);preference.removeEventListener('change',reduce);context.revert();};
      },host??el);
    }).catch(finish);
    return()=>{cancelled=true;window.removeEventListener('resize',resize);cleanup();};
  },[]);
  const skipCinematic=()=>{callbacks.current.onCovered();callbacks.current.onComplete();};
  return <div className="ef-meteor-overlay" role="dialog" aria-modal="true" aria-label="Across the ages cinematic" onKeyDown={event=>{
    if(event.key==='Escape'){event.preventDefault();skipCinematic();}
    if(event.key==='Tab'){event.preventDefault();skip.current?.focus();}
  }}>
    <canvas ref={canvas} width={768} height={480} aria-hidden="true" />
    <p className="ef-cinematic-caption">One shore. A thousand stories.</p>
    <button ref={skip} type="button" className="ef-cinematic-skip" onClick={skipCinematic}>Skip cinematic <span aria-hidden="true">↗</span></button>
  </div>;
}
