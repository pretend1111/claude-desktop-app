import React from 'react';
import { OriginalSvgPaths } from '../../icons';

interface SvgIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'id'> {
  id?: string;
  ids?: string[];
}

const EXACT_VIEWBOXES: Record<string, string> = {
  "p1ed7f400": "0 0 32 32",
  "pde2630": "0 0 16 16",
  "p1dfefa80": "0 0 15.6248 15.6256",
  "pa173e00": "0 0 19.9996 17.4999",
  "p254e9040": "0 0 18.7496 15",
  "p3dd3fc00": "0 0 17.5 16.25",
  "p27281480": "0 0 13.7501 17.502",
  "p18918770": "0 0 16 16"
};

export function SvgIcon({ id, ids, className = "w-5 h-5", viewBox, fill = "currentColor", ...props }: SvgIconProps) {
  const iconIds = ids || (id ? [id] : []);
  const paths = iconIds.map(i => OriginalSvgPaths[i]).filter(Boolean);
  
  const finalViewBox = viewBox || (id && EXACT_VIEWBOXES[id]) || "0 0 20 20";
  
  if (paths.length === 0) {
    console.warn(`SvgIcon: Paths not found for`, iconIds);
    return <svg className={className} viewBox={viewBox} {...props} />;
  }

  return (
    <svg className={className} fill="none" preserveAspectRatio="none" viewBox={finalViewBox} {...props}>
      {paths.map((p, index) => (
        <path key={index} d={p} fill={fill} fillRule="evenodd" clipRule="evenodd" />
      ))}
    </svg>
  );
}
