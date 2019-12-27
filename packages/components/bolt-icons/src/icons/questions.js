import * as Icons from '@bolt/components-icon/registry';
import { h } from '@bolt/core-v3.x/renderers';

export const Questions = ({ bgColor, fgColor, size, ...otherProps }) => {
  return (
    <svg {...otherProps} viewBox="0 0 47 46">
      <g fill-rule="evenodd">
        <path d="M.018 20.568c0 6.542 3.508 12.361 8.956 16.103v9.414l8.584-5.71a26.4 26.4 0 005.748.631c12.864 0 23.292-9.152 23.292-20.438C46.598 9.283 36.17.134 23.306.134 10.446.134.018 9.283.018 20.568zm12.54 14.24c-5.39-3.04-8.958-8.29-8.958-14.264 0-9.402 8.824-17.022 19.706-17.022 10.887 0 19.707 7.62 19.707 17.022 0 9.398-8.82 17.022-19.707 17.022-2.173 0-4.263-.31-6.218-.873l-4.53 2.582v-4.467z" />
        <path d="M21.288 27.763c0 .978.782 1.717 1.817 1.717 1.067 0 1.84-.722 1.84-1.717 0-1.007-.763-1.735-1.817-1.735-1.068 0-1.84.728-1.84 1.735zM19.495 13.225l-.368.266.981 2.548.635-.478c.447-.336 1.205-.561 1.879-.561 1.016.014 1.531.454 1.531 1.305 0 .728-.371 1.42-1.421 2.642-1.152 1.367-1.675 2.84-1.519 4.24l.085 1.116h2.914l-.047-1.198c-.058-.998.268-1.817 1.13-2.827 1.167-1.368 2.058-2.547 2.058-4.217 0-1.908-1.336-3.831-4.318-3.831-1.31 0-2.698.39-3.54.995z" />
      </g>
    </svg>
  );
};

Icons.set('questions', Questions);
