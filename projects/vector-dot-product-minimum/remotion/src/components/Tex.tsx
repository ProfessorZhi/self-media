import katex from 'katex';
import React, {useMemo} from 'react';

export const Tex: React.FC<{tex: string; size?: number; color?: string; style?: React.CSSProperties}> = ({
  tex,
  size = 56,
  color = 'inherit',
  style,
}) => {
  const html = useMemo(() => katex.renderToString(tex, {throwOnError: true, output: 'html', strict: 'ignore'}), [tex]);
  return <span style={{fontSize: size, color, lineHeight: 1, whiteSpace: 'nowrap', ...style}} dangerouslySetInnerHTML={{__html: html}} />;
};
