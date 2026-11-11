export const METEOR_DURATION = 10.8;
export function meteorPhase(time:number) {
  return time<1.5?'quiet':time<5?'descent':time<6.5?'impact':time<7.1?'covered':time<METEOR_DURATION?'reveal':'complete';
}

/** A temporary, deterministic cinematic overlay. Never part of the historical simulation. */
export function drawMeteor(c:CanvasRenderingContext2D,time:number,width:number,height:number) {
  c.clearRect(0,0,width,height);
  const phase=meteorPhase(time), impactX=width*.61,impactY=height*.71;
  if(time<5){
    c.fillStyle=`rgba(15,28,39,${Math.min(.42,time*.095)})`;c.fillRect(0,0,width,height);
    if(time>1.5){
      const progress=Math.min(1,(time-1.5)/3.5),p=progress*progress;
      const x=width*.83+(impactX-width*.83)*p,y=-35+(impactY+35)*p;
      for(let i=55;i>=0;i--){
        const behind=i/55,tx=x+behind*(30+progress*80),ty=y-behind*(55+progress*160);
        const size=Math.max(1,Math.round((1-behind)*(3+progress*10)));
        c.globalAlpha=(1-behind)*.65;c.fillStyle=i%3===0?'#fff1bc':'#e8b26d';
        c.fillRect(Math.round(tx),Math.round(ty),size,size);
      }
      for(let i=0;i<32;i++){
        const age=(time*.7+i*.137)%1,seed=(i*31)%17;
        c.globalAlpha=(1-age)*.65;c.fillStyle=i%2?'#f4ce95':'#bad8d0';
        c.fillRect(Math.round(x+age*(24+seed*3)+Math.sin(i*2.4)*age*22),Math.round(y-age*130+Math.cos(i)*age*20),2,2);
      }
      // Stepped light shells and a faceted hot core, all on the same square pixel grid.
      const cx=Math.round(x),cy=Math.round(y),core=4+Math.round(progress*5);
      for(let shell=3;shell>=0;shell--){
        const radius=core+shell*5;
        c.globalAlpha=shell===0?1:.035+(3-shell)*.025;
        c.fillStyle=shell===0?'#fff6cf':'#ffd59b';
        for(let yy=-radius;yy<=radius;yy+=2){
          const half=Math.round(Math.sqrt(Math.max(0,radius*radius-yy*yy))/2)*2;
          c.fillRect(cx-half,cy+yy,half*2,2);
        }
      }
      c.globalAlpha=1;c.fillStyle='#ffffff';c.fillRect(cx-2,cy-core+2,4,core*2-3);
      c.fillRect(cx-core+2,cy-2,core*2-3,4);
      c.fillStyle='#efb476';c.fillRect(cx-core,cy+2,3,3);
    }
  } else {
    const age=time-5, cover=Math.max(0,Math.min(1,age/1.5));
    if(time<7.1){
      // One sustained warm flare, not repeated high-contrast flashes.
      for(let ring=3;ring>=0;ring--){
        const radius=(age*.92+ring*.06)*Math.max(width,height);
        c.fillStyle=['#fff6d7','#ffe6ac','#f2bf78','#d98d5760'][ring];
        const step=4;
        for(let yy=Math.max(0,Math.floor(impactY-radius));yy<Math.min(height,impactY+radius);yy+=step){
          const dx=Math.sqrt(Math.max(0,radius*radius-(yy-impactY)*(yy-impactY)));
          c.fillRect(Math.round((impactX-dx)/step)*step,Math.round(yy/step)*step,Math.round(dx*2/step)*step,step);
        }
      }
      c.globalAlpha=cover*.85;c.fillStyle='#fff6dc';c.fillRect(0,0,width,height);c.globalAlpha=1;
    } else {
      c.globalAlpha=Math.max(0,1-(time-7.1)/3.7);c.fillStyle='#fff6dc';c.fillRect(0,0,width,height);c.globalAlpha=1;
    }
    if(time<10){
      const radius=age*110;
      c.strokeStyle=`rgba(255,237,184,${Math.max(0,.6-age*.12)})`;c.lineWidth=2;
      c.beginPath();c.ellipse(impactX,impactY,radius*1.7,radius*.54,0,0,Math.PI*2);c.stroke();
      for(let i=0;i<84;i++){
        const angle=i*2.39996,speed=22+i%13*7;
        const x=impactX+Math.cos(angle)*speed*age,y=impactY+Math.sin(angle)*speed*age+age*age*11;
        c.globalAlpha=Math.max(0,1-age/5);c.fillStyle=['#fff0ba','#dfb379','#91b5ba','#b69bc7'][i%4];
        const size=2+i%4;c.fillRect(Math.round(x),Math.round(y),size,size);
      }
    }
  }
  c.globalAlpha=1;
  return phase;
}
