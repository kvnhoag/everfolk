import PixelIcon from './PixelIcon.tsx';

export const SKILL_ICON_IDS = new Set(['craft','pottery','carving','sculpture','literacy','oratory','philosophy','reckoning','astronomy','astrology','seamanship','warfare','music']);

export default function SkillArtwork({id}:{id:string}) {
  if(!SKILL_ICON_IDS.has(id)) return <PixelIcon name={id} size={32}/>;
  const url=`url('/assets/skill-icons/open-source-v3/${id}.svg')`;
  return <span className="skill-artwork skill-artwork-open" aria-hidden="true" style={{maskImage:url,WebkitMaskImage:url}}/>;
}
