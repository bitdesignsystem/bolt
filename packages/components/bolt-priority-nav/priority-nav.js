import {
  h,
  render,
  define,
  props,
  BoltComponent,
  css,
  spacingSizes,
  hasNativeShadowDomSupport,
} from '@bolt/core';

/*
  Consider using these polyfills to broaden browser support:
    — https://www.npmjs.com/package/classlist-polyfill
    — https://www.npmjs.com/package/nodelist-foreach-polyfill
*/


@define
export class BoltPriorityNav extends BoltComponent() {
  static is = 'bolt-priority-nav';

  constructor(self) {
    self = super(self);
    this.activeLink = false;
    this.useShadow = hasNativeShadowDomSupport;

    this._adaptPriorityNav = this._adaptPriorityNav.bind(this);
    this._handleDropdownToggle = this._handleDropdownToggle.bind(this);

    return self;
  }

  connecting() {
    Promise.all([
      customElements.whenDefined('bolt-navlink'),
    ]).then(_ => {
      this.isOpen = false;
      this.offsettolerance = 5; // Extra wiggle room when calculating how many items can fit

      this.containerTabs = this.querySelector('.c-bolt-priority-nav');
      this.primaryNav = this.querySelector('.c-bolt-priority-nav__primary');
      this.primaryItems = this.querySelectorAll('.c-bolt-priority-nav__primary > .c-bolt-priority-nav__item:not(.c-bolt-priority-nav__item--show-more)');
      this.containerTabs.classList.add('is-ready');
      this.classList.add('is-ready');

      this.primaryNav.insertAdjacentHTML('beforeend', `
        <li class="c-bolt-priority-nav__item c-bolt-priority-nav__show-more">
          <button type="button" aria-haspopup="true" aria-expanded="false" class="c-bolt-priority-nav__button c-bolt-priority-nav__show-button">
            <span class="c-bolt-priority-nav__show-text">
              More
            </span>
            <span class="c-bolt-priority-nav__show-icon">
              <bolt-icon name="chevron-down"></bolt-icon>
            </span>
          </button>
          <div class="c-bolt-priority-nav__dropdown">
            <ul class="c-bolt-priority-nav__list c-bolt-priority-nav__dropdown-list">
              ${this.primaryNav.innerHTML}
            </ul>
          </div>
        </li>
      `);

      this.priorityDropdown = this.querySelector('.c-bolt-priority-nav__dropdown');
      this.dropdownItems = this.priorityDropdown.querySelectorAll('li');
      this.allItems = this.querySelectorAll('li');
      this.moreLi = this.primaryNav.querySelector('.c-bolt-priority-nav__show-more');
      this.moreBtn = this.moreLi.querySelector('.c-bolt-priority-nav__show-button');

      this._adaptPriorityNav();
      this._handleExternalClicks();

      this.moreBtn.addEventListener('click', this._handleDropdownToggle);
      this.addEventListener('activateLink', this._onActivateLink);
      window.addEventListener('optimizedResize', this._adaptPriorityNav);
    });
  }

  render() {
    return this.html `
      ${this.slot('default')}
    `
  }

  _adaptPriorityNav() {
    this.classList.add('is-resizing');

    // reveal all items for the calculation
    this.allItems.forEach((item) => {
      item.classList.remove('is-hidden');
    });

    // hide items that won't fit in the Primary
    let stopWidth = this.moreBtn.offsetWidth;
    let hiddenItems = [];

    const primaryWidth = this.primaryNav.offsetWidth;


    this.primaryItems.forEach((item, i) => {
      if (primaryWidth + this.offsettolerance >= stopWidth + item.offsetWidth) {
        stopWidth += item.offsetWidth;
      } else {
        item.classList.add('is-hidden');
        hiddenItems.push(i);
      }
    });

    // toggle the visibility of More button and items in Secondary
    if (!hiddenItems.length) {
      this.isOpen = false;
      this.removeAttribute('open');
      this.moreLi.classList.add('is-hidden');
      this.containerTabs.classList.remove('c-bolt-priority-nav--show-dropdown');
      this.moreBtn.classList.remove('is-active');
      this.moreBtn.setAttribute('aria-expanded', false);
    } else {
      this.dropdownItems.forEach((item, i) => {
        if (!hiddenItems.includes(i)) {
          item.classList.add('is-hidden');
        }
      })
    }

    this.classList.remove('is-resizing');
  }


  _handleExternalClicks(){
    document.addEventListener('click', (e) => {
      let el = e.target
      while(el) {
        if(el === this.priorityDropdown || el === this.moreBtn) {
          return;
        }
        el = el.parentNode;
      }

      this.close();
    });
  }

  // `_onActiveLink` handles the `activateLink` event emitted by the children
  _onActivateLink(event) {
    this.close();
  }

  _upgradeProperty(prop) {
    if (this.hasOwnProperty(prop)) {
      let value = this[prop];
      delete this[prop];
      this[prop] = value;
    }
  }

  _handleDropdownToggle(e){
    e.preventDefault();
    this.isOpen = !this.isOpen;

    this._toggleDropdown();
  }

  _toggleDropdown(){
    if (this.isOpen) {
      this.open();
    } else {
      this.close();
    }
  }

  open() {
    this.isOpen = true;
    this.setAttribute('open', true);
    this.containerTabs.classList.add('c-bolt-priority-nav--show-dropdown');
    this.moreBtn.classList.add('is-active');
    this.moreBtn.setAttribute('aria-expanded', true);
  }

  close(){
    this.isOpen = false;
    this.removeAttribute('open');
    this.containerTabs.classList.remove('c-bolt-priority-nav--show-dropdown');
    this.moreBtn.classList.remove('is-active');
    this.moreBtn.setAttribute('aria-expanded', false);
  }

  // Clean up event listeners when being removed from the page
  disconnecting() {
    this.removeEventListener('activateLink', this._onActivateLink);
    window.removeEventListener('optimizedResize', this._adaptPriorityNav);
  }
}


// Create a custom 'optimizedResize' event that works just like window.resize but is more performant because it
// won't fire before a previous event is complete.
// This was adapted from https://developer.mozilla.org/en-US/docs/Web/Events/resize
(function () {
  function throttle(type, name, obj) {
    obj = obj || window;
    let running = false;

    function func() {
      if (running) {
        return;
      }
      running = true;
      requestAnimationFrame(function () {
        obj.dispatchEvent(new CustomEvent(name));
        running = false;
      });
    }
    obj.addEventListener(type, func);
  }

  // Initialize on window.resize event.  Note that throttle can also be initialized on any type of event,
  // such as scroll.
  throttle('resize', 'optimizedResize');
})();
