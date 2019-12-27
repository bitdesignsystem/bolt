import { props, css, hasNativeShadowDomSupport } from '@bolt/core-v3.x/utils';
import { withLitHtml } from '@bolt/core-v3.x/renderers/renderer-lit-html';
import { html, customElement } from '@bolt/element';
import placeholderStyles from './placeholder.scss';

@customElement('bolt-placeholder')
class BoltPlaceholder extends withLitHtml {
  static props = {
    animated: props.boolean,
    size: props.string,
  };

  // https://github.com/WebReflection/document-register-element#upgrading-the-constructor-context
  constructor(self) {
    self = super(self);
    self.useShadow = hasNativeShadowDomSupport;
    return self;
  }

  connecting() {
    // this.addEventListener('click', this.clickHandler);
  }

  disconnecting() {
    // this.removeEventListener('click', this.clickHandler);
  }

  render({ props, state }) {
    const classes = css('c-bolt-placeholder');

    const wrapperClasses = css(
      'c-bolt-placeholder__wrapper ',
      this.props.animated ? 'c-bolt-placeholder__wrapper--animated' : '',
    );

    const contentClasses = css(
      'c-bolt-placeholder__content',
      this.props.size
        ? `c-bolt-placeholder__content--${this.props.size}`
        : 'c-bolt-placeholder__content--medium',
    );

    return html`
      ${this.addStyles([placeholderStyles])}
      <div class="${classes}">
        <div class="${wrapperClasses}">
          <div class="c-bolt-placeholder__wrapper-y"></div>
          <div class="c-bolt-placeholder__wrapper-x"></div>
          <div class="${contentClasses}">${this.slot('default')}</div>
        </div>
      </div>
    `;
  }
}

export { BoltPlaceholder };
