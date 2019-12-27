import * as Icons from '@bolt/components-icon/registry';
import { h } from '@bolt/core-v3.x/renderers';

export const Reply = ({ bgColor, fgColor, size, ...otherProps }) => {
  return (
    <svg baseProfile="full" {...otherProps} viewBox="0 0 24 24">
      <path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
    </svg>
  );
};

Icons.set('reply', Reply);
