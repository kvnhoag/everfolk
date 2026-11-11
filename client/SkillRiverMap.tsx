import { forwardRef, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, RefObject } from 'react';
import type { SkillNode, SkillTreeModel } from './skill-tree.ts';
import { isMainRiverEdge, skillRiverGroups, skillRiverPath } from './skill-river.ts';
import type { RiverBox } from './skill-river.ts';
import SkillArtwork from './SkillArtwork.tsx';
import { formatSkillValue as skillNumber } from './skill-growth.ts';

export interface SkillRiverHandle { focusSkill: (id:string)=>void }
interface Geometry { width:number; height:number; boxes:Record<string,RiverBox> }
interface Preview { id:string; left:number; top:number; width:number; maxHeight:number }

function visibleButtons(ref:RefObject<Record<string,HTMLButtonElement|null>>) {
  return Object.entries(ref.current).filter((entry):entry is [string,HTMLButtonElement]=>!!entry[1] && entry[1].getClientRects().length>0);
}

const SkillRiverMap = forwardRef<SkillRiverHandle, {model:SkillTreeModel; query:string; selectedId:string; detailOpen:boolean; age:number; detailId:string; onSelect:(id:string)=>void}>(function SkillRiverMap({model,query,selectedId,detailOpen,age,detailId,onSelect},ref) {
  const groups=useMemo(()=>skillRiverGroups(model),[model]);
  const [branch,setBranch]=useState('all');
  const [preview,setPreview]=useState<Preview|null>(null);
  const [geometry,setGeometry]=useState<Geometry>({width:0,height:0,boxes:{}});
  const boardRef=useRef<HTMLDivElement>(null);
  const branchNavRef=useRef<HTMLElement>(null);
  const nodeRefs=useRef<Record<string,HTMLButtonElement|null>>({});
  const closeTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const touchPreview=useRef(false);
  const id=useId();
  const previousQuery=useRef('');
  const narrow=geometry.width>0 && geometry.width<=860;
  const previewNode=model.nodes.find(node=>node.id===preview?.id);
  const exploring=previewNode?.id ?? (detailOpen?selectedId:null);
  const related=new Set(exploring?[exploring,...model.edges.flatMap(edge=>edge.from===exploring?[edge.to]:edge.to===exploring?[edge.from]:[])]:[]);
  const matches=(node:SkillNode)=>`${node.label} ${node.branch} ${node.description}`.toLocaleLowerCase().includes(query);
  const activeBranch=groups.some(group=>group.label===branch)?branch:'all';
  useEffect(()=>{
    const nav=branchNavRef.current, button=nav?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if(narrow && nav && button) nav.scrollLeft=button.offsetLeft-nav.offsetLeft-nav.clientWidth/2+button.offsetWidth/2;
  },[activeBranch,narrow]);
  useEffect(()=>{
    if(query) {
      const match=model.nodes.find(node=>`${node.label} ${node.branch} ${node.description}`.toLocaleLowerCase().includes(query));
      if(match) setBranch(match.branch);
    } else if(previousQuery.current) setBranch('all');
    previousQuery.current=query;
  },[query,model]);

  function dismiss() { if(closeTimer.current) clearTimeout(closeTimer.current); setPreview(null); }
  function showPreview(nodeId:string) {
    if(closeTimer.current) clearTimeout(closeTimer.current);
    const button=nodeRefs.current[nodeId], board=boardRef.current;
    if(!button || !board) return;
    const p=button.getBoundingClientRect(), box=board.getBoundingClientRect();
    const dialog=board.closest('dialog')?.getBoundingClientRect();
    const width=Math.min(280,box.width-24);
    const visibleTop=Math.max(12,(dialog?.top??0)-box.top+12);
    const visibleBottom=Math.min(box.height-12,(dialog?.bottom??innerHeight)-box.top-12,innerHeight-box.top-12);
    const maxHeight=Math.min(265,Math.max(72,visibleBottom-visibleTop));
    const preferred=p.bottom-box.top+15;
    const top=preferred+maxHeight<=visibleBottom?preferred:p.top-box.top-maxHeight-14;
    setPreview({id:nodeId,width,maxHeight,left:Math.max(12,Math.min(p.left-box.left+p.width/2-width/2,box.width-width-12)),top:Math.max(visibleTop,Math.min(top,visibleBottom-maxHeight))});
  }
  function leave() { if(closeTimer.current) clearTimeout(closeTimer.current); closeTimer.current=setTimeout(()=>setPreview(null),180); }
  function focusNode(nodeId:string) {
    const button=nodeRefs.current[nodeId];
    button?.focus({preventScroll:true});
    button?.scrollIntoView({block:'nearest',inline:'nearest'});
    showPreview(nodeId);
  }
  useImperativeHandle(ref,()=>({focusSkill(nodeId) {
    const node=model.nodes.find(node=>node.id===nodeId);
    if(!node) return;
    const button=nodeRefs.current[nodeId];
    if(!button?.getClientRects().length) setBranch(node.branch);
    requestAnimationFrame(()=>focusNode(nodeId));
  }}));
  useEffect(()=>()=>{if(closeTimer.current) clearTimeout(closeTimer.current);},[]);
  useEffect(()=>{dismiss();},[model,branch]);
  useLayoutEffect(()=>{
    const board=boardRef.current;
    if(!board) return;
    const measure=()=>{
      const bounds=board.getBoundingClientRect();
      const boxes=Object.fromEntries(visibleButtons(nodeRefs).map(([key,button])=>{const r=(button.querySelector('.skill-artwork')??button).getBoundingClientRect();return[key,{x:r.left-bounds.left,y:r.top-bounds.top,width:r.width,height:r.height}];}));
      setGeometry(previous=>{
        const next={width:bounds.width,height:bounds.height,boxes};
        return JSON.stringify(previous)===JSON.stringify(next)?previous:next;
      });
      setPreview(null);
    };
    measure();
    const observer=new ResizeObserver(measure); observer.observe(board);
    window.addEventListener('resize',measure);
    return()=>{observer.disconnect();window.removeEventListener('resize',measure);};
  },[model,activeBranch]);

  function navigate(event:KeyboardEvent<HTMLButtonElement>,node:SkillNode) {
    if(event.key==='Escape' && preview) {event.preventDefault();event.stopPropagation();dismiss();return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
    event.preventDefault();
    const buttons=visibleButtons(nodeRefs);
    if(event.key==='Home' || event.key==='End') {focusNode(buttons[event.key==='Home'?0:buttons.length-1][0]);return;}
    const origin=nodeRefs.current[node.id]!.getBoundingClientRect();
    const horizontal=event.key==='ArrowLeft'||event.key==='ArrowRight';
    const direction=event.key==='ArrowLeft'||event.key==='ArrowUp'?-1:1;
    const candidates=buttons.filter(([key,button])=>key!==node.id && (horizontal?button.getBoundingClientRect().left-origin.left:button.getBoundingClientRect().top-origin.top)*direction>1);
    const score=(button:HTMLButtonElement)=>{const r=button.getBoundingClientRect();return horizontal?Math.abs(r.left-origin.left)+Math.abs(r.top-origin.top)*2:Math.abs(r.top-origin.top)+Math.abs(r.left-origin.left)*2;};
    candidates.sort((a,b)=>score(a[1])-score(b[1]));
    if(candidates[0]) focusNode(candidates[0][0]);
  }

  return <div className="skill-tree-map-wrap skill-delta-wrap">
    <nav ref={branchNavRef} className="skill-delta-branches" aria-label="Explore skill branches">
      <button type="button" className="delta-all-branches" aria-pressed={activeBranch==='all'&&!narrow} onClick={()=>setBranch('all')}>All branches</button>
      {groups.map((group,index)=><button type="button" key={group.label} className={activeBranch===group.label || activeBranch==='all'&&index===0?'is-mobile-active':''} aria-pressed={activeBranch===group.label || narrow&&activeBranch==='all'&&index===0} onClick={()=>setBranch(group.label)}>{group.label}</button>)}
    </nav>
    <div className="skill-tree-scroll skill-delta-viewport" role="region" aria-label="Skill river map, explore a branch or use arrow keys" tabIndex={0} onKeyDown={event=>{if(event.target===event.currentTarget&&event.key==='ArrowDown'){event.preventDefault();const first=visibleButtons(nodeRefs)[0];if(first)focusNode(first[0]);}}}>
      <div ref={boardRef} className={`skill-tree-board skill-delta-board${activeBranch!=='all'?' is-filtered':''}`} onClick={event=>{if(!(event.target as Element).closest('.skill-tree-node,[role="tooltip"]'))dismiss();}}>
        <div className="skill-delta-source"><span aria-hidden="true">◆</span><span>One beginning. Many possible lives.</span></div>
        <svg className="skill-delta-water" width="100%" height="100%" aria-hidden="true">
          {model.nodes.filter(node=>!model.edges.some(edge=>edge.to===node.id)&&geometry.boxes[node.id]).map(node=>{
            const p=geometry.boxes[node.id],x=p.x+p.width/2,y=p.y-5;
            const path=`M ${geometry.width/2} 42 L ${geometry.width/2} 64 L ${x} 64 L ${x} ${y}`;
            return <g key={node.id} className="delta-root-flow"><path className="delta-river-bank" d={path}/><path className="delta-river-stream" d={path}/></g>;
          })}
          {model.edges.filter(edge=>isMainRiverEdge(edge,model)).map(edge=>{
            const from=geometry.boxes[edge.from],to=geometry.boxes[edge.to];
            if(!from || !to)return null;
            const active=exploring===edge.from||exploring===edge.to;
            return <g key={`${edge.from}-${edge.to}`} data-from={edge.from} data-to={edge.to} className={`delta-link is-main${edge.met?' is-met':''}${active?' is-active':''}`}>
              <path className="delta-river-stream" d={skillRiverPath(from,to,true)}/>
            </g>;
          })}
        </svg>
        <div className={`skill-delta-grid${activeBranch!=='all'?' is-filtered':''}`}>
          {groups.map((group,index)=><section data-branch-index={index%5} className={`skill-delta-channel${activeBranch===group.label || activeBranch==='all'&&index===0?' is-branch-active':''}`} key={group.label} aria-label={`${group.label} skill branch`}>
            <header><span className="delta-branch-number">0{index+1}</span><h4>{group.label}</h4></header>
            {group.stages.map((nodes,tier)=><div className="skill-delta-stage" data-stage={tier} key={tier}>{nodes.map(node=><div className="skill-delta-node-slot" key={node.id}>
              <button type="button" data-skill-id={node.id} ref={button=>{nodeRefs.current[node.id]=button;}}
                className={`skill-tree-node is-${node.state}${detailOpen&&selectedId===node.id?' is-selected':''}${exploring&&related.has(node.id)?' is-related':''}${exploring&&!related.has(node.id)?' is-unrelated':''}${query&&matches(node)?' is-search-match':''}${query&&!matches(node)?' is-search-muted':''}`}
                aria-controls={detailId} aria-pressed={detailOpen&&selectedId===node.id} aria-describedby={preview?.id===node.id?`${id}-preview`:undefined}
                aria-label={`${node.label}, ${skillNumber(node.value,node.max)} of ${node.max}, ${node.state}${node.requirements.length?`, requires ${node.requirements.map(item=>`${item.label} ${item.required}`).join(', ')}`:''}`}
                onFocus={()=>showPreview(node.id)} onBlur={dismiss} onKeyDown={event=>navigate(event,node)}
                onPointerEnter={event=>{if(event.pointerType!=='touch')showPreview(node.id);}} onPointerLeave={event=>{if(event.pointerType!=='touch')leave();}}
                onPointerDown={event=>{touchPreview.current=event.pointerType==='touch'&&preview?.id!==node.id;}}
                onClick={()=>{if(touchPreview.current){touchPreview.current=false;showPreview(node.id);}else{dismiss();onSelect(node.id);}}}>
                <SkillArtwork id={node.id}/>
                <span className="skill-delta-status" aria-hidden="true">{node.state==='locked'?'×':node.state==='mastered'?'★':node.state==='learning'?'•':'+'}</span>
              </button>
            </div>)}</div>)}
          </section>)}
        </div>
        {preview&&previewNode&&<div id={`${id}-preview`} role="tooltip" className={`skill-river-preview is-${previewNode.state}`} style={{left:preview.left,top:preview.top,width:preview.width,maxHeight:preview.maxHeight}} onPointerEnter={()=>{if(closeTimer.current)clearTimeout(closeTimer.current);}} onPointerLeave={leave}>
          <div className="skill-preview-heading"><SkillArtwork id={previewNode.id}/><strong>{previewNode.label}</strong><span>{previewNode.state}</span></div>
          <p>{previewNode.description}</p><div className="skill-preview-value"><span>Proficiency</span><strong>{skillNumber(previewNode.value,previewNode.max)} / {previewNode.max}</strong></div>
          {previewNode.minAge>0&&<p className="skill-preview-requirement">{previewNode.ageMet?'✓':'○'} Age {previewNode.minAge}+{!previewNode.ageMet&&` · you are ${age}`}</p>}
          {previewNode.requirements.map(item=><p className="skill-preview-requirement" key={item.id}>{item.met?'✓':'○'} Requires: {item.label} {item.required} <span className="skill-preview-current">· you have {skillNumber(item.value,item.required)}</span></p>)}
          <span className="skill-preview-hint">Select to explore · tap again on touch</span>
        </div>}
      </div>
    </div>
  </div>;
});

export default SkillRiverMap;
