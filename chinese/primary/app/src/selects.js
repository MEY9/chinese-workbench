/* Offline single-select enhancement. Native fields remain the form/data source. */
(() => {
  'use strict';
  const instances = new Map();
  let sequence = 0, opened = null, queued = false;
  const normalize = value => String(value).normalize('NFKC').trim().toLocaleLowerCase();
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function labelFor(select) {
    const labelled = (select.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)
      .map(id => document.getElementById(id)?.textContent || '').join(' ').trim();
    if (labelled) return labelled;
    if (select.getAttribute('aria-label')) return select.getAttribute('aria-label');
    const label = select.labels?.[0];
    if (label) {
      const copy = label.cloneNode(true);
      copy.querySelectorAll('select,.book-select,.field-error').forEach(node => node.remove());
      if (copy.textContent.trim()) return copy.textContent.trim();
    }
    return select.name?.startsWith('stu_status_') ? '学生批改状态' : '选择选项';
  }
  class BookSelect {
    constructor(select) {
      this.select = select;
      this.label = labelFor(select);
      this.originalTabIndex = select.getAttribute('tabindex');
      this.originalAriaHidden = select.getAttribute('aria-hidden');
      this.wrapper = element('span', 'book-select');
      select.before(this.wrapper);
      this.wrapper.append(select);
      this.button = element('button', 'book-select-trigger');
      this.button.type = 'button';
      this.button.setAttribute('role', 'combobox');
      this.button.setAttribute('aria-haspopup', 'listbox');
      this.button.setAttribute('aria-expanded', 'false');
      this.text = element('span', 'book-select-value');
      const arrow = element('span', 'book-select-arrow');
      arrow.setAttribute('aria-hidden', 'true');
      this.button.append(this.text, arrow);
      this.wrapper.append(this.button);
      select.classList.add('book-select-native');
      select.tabIndex = -1;
      select.setAttribute('aria-hidden', 'true');
      this.button.addEventListener('click', () => opened === this ? this.close() : this.open());
      this.button.addEventListener('keydown', event => this.keydown(event));
      this.sync();
    }
    sync() {
      const select = this.select;
      const text = select.selectedOptions[0]?.label || '请选择';
      if (this.text.textContent !== text) this.text.textContent = text;
      this.button.title = text;
      this.button.disabled = select.matches(':disabled');
      this.button.setAttribute('aria-label', `${this.label}：${text}`);
      this.button.setAttribute('aria-required', String(select.required));
      this.button.setAttribute('aria-invalid', String(select.classList.contains('invalid') || select.getAttribute('aria-invalid') === 'true'));
      for (const kind of ['st-ok', 'st-wait', 'st-rev']) this.button.classList.toggle(kind, select.classList.contains(kind));
      this.wrapper.classList.toggle('book-select-disabled', this.button.disabled);
      if (opened === this && this.button.disabled) this.close();
      if (opened === this && this.optionSignature !== JSON.stringify([this.options(), select.selectedIndex])) this.renderOptions(true);
    }
    options() {
      return [...this.select.options].map((option, index) => ({
        index, label: option.label, value: option.value,
        group: option.parentElement.tagName === 'OPTGROUP' ? option.parentElement.label : '',
        disabled: option.disabled || (option.parentElement.tagName === 'OPTGROUP' && option.parentElement.disabled),
        hidden: option.hidden || option.parentElement.hidden
      })).filter(option => !option.hidden);
    }
    open() {
      this.sync();
      if (this.button.disabled || !this.select.isConnected) return;
      if (opened) opened.close();
      opened = this;
      const id = `book-options-${++sequence}`;
      this.panel = element('div', 'book-select-menu');
      this.panel.setAttribute('popover', 'manual');
      this.panel.setAttribute('aria-label', this.label);
      this.search = element('input', 'book-select-search');
      this.search.type = 'search';
      this.search.placeholder = '输入名称或学号查找';
      this.search.setAttribute('aria-label', `搜索${this.label}`);
      this.search.setAttribute('role', 'combobox');
      this.search.setAttribute('aria-autocomplete', 'list');
      this.search.setAttribute('aria-expanded', 'true');
      this.search.setAttribute('aria-controls', id);
      this.search.autocomplete = 'off';
      this.search.hidden = this.options().length < 10;
      this.list = element('div', 'book-select-options');
      this.list.id = id;
      this.list.setAttribute('role', 'listbox');
      this.list.setAttribute('aria-label', this.label);
      this.empty = element('div', 'book-select-empty', '没有找到匹配项');
      this.empty.setAttribute('role', 'status');
      this.panel.append(this.search, this.list, this.empty);
      // A popover enters the top layer while remaining inside the modal focus boundary.
      (this.select.closest('[role="dialog"],.modal-mask') || document.body).append(this.panel);
      this.button.setAttribute('aria-expanded', 'true');
      this.button.setAttribute('aria-controls', id);
      this.search.addEventListener('input', () => this.renderOptions());
      this.panel.addEventListener('keydown', event => this.keydown(event));
      this.panel.addEventListener('pointerdown', event => {
        if (event.target.closest('[role="option"]')) event.preventDefault();
      });
      this.panel.addEventListener('click', event => {
        const option = event.target.closest('[role="option"]');
        if (option && option.getAttribute('aria-disabled') !== 'true') this.choose(Number(option.dataset.index));
      });
      this.renderOptions(true);
      if (typeof this.panel.showPopover === 'function') this.panel.showPopover();
      this.position();
      if (!this.search.hidden) this.search.focus();
    }
    renderOptions(initial = false) {
      this.optionSignature = JSON.stringify([this.options(), this.select.selectedIndex]);
      const query = normalize(this.search.value);
      this.visible = this.options().filter(option => normalize(`${option.label} ${option.group}`).includes(query));
      this.list.replaceChildren();
      let group = '';
      for (const option of this.visible) {
        if (option.group && option.group !== group) {
          this.list.append(element('div', 'book-select-group', option.group));
        }
        group = option.group;
        const row = element('div', 'book-select-option');
        row.id = `${this.list.id}-${option.index}`;
        row.dataset.index = String(option.index);
        row.setAttribute('role', 'option');
        row.setAttribute('aria-selected', String(option.index === this.select.selectedIndex));
        row.setAttribute('aria-disabled', String(Boolean(option.disabled)));
        const check = element('span', 'book-select-check', option.index === this.select.selectedIndex ? '✓' : '');
        check.setAttribute('aria-hidden', 'true');
        row.append(element('span', 'book-select-option-label', option.label), check);
        this.list.append(row);
      }
      this.empty.hidden = this.visible.length !== 0;
      this.empty.textContent = query ? '没有找到匹配项' : '暂无可选项';
      const enabled = this.visible.filter(option => !option.disabled);
      this.highlight(initial && enabled.some(option => option.index === this.select.selectedIndex)
        ? this.select.selectedIndex : enabled[0]?.index ?? -1);
      this.position();
    }
    highlight(index) {
      this.active = index;
      this.list.querySelectorAll('[role="option"]').forEach(row => row.classList.toggle('is-active', Number(row.dataset.index) === index));
      const row = this.list.querySelector(`[data-index="${index}"]`);
      for (const control of [this.button, this.search]) {
        if (row) control.setAttribute('aria-activedescendant', row.id);
        else control.removeAttribute('aria-activedescendant');
      }
      if (row) {
        const top = row.offsetTop - this.list.offsetTop;
        if (top < this.list.scrollTop) this.list.scrollTop = top;
        else if (top + row.offsetHeight > this.list.scrollTop + this.list.clientHeight) this.list.scrollTop = top + row.offsetHeight - this.list.clientHeight;
      }
    }
    choose(index) {
      const option = this.select.options[index];
      if (!option || option.disabled || option.parentElement.disabled || this.select.matches(':disabled')) return;
      const changed = this.select.selectedIndex !== index;
      this.select.selectedIndex = index;
      this.close(true);
      this.sync();
      if (changed) {
        // Existing delegated handlers, FormData, drafts and SQLite keep using the native field.
        this.select.dispatchEvent(new Event('input', {bubbles: true}));
        this.select.dispatchEvent(new Event('change', {bubbles: true}));
        const id = this.select.id;
        queueMicrotask(() => {
          if (!this.button.isConnected && id) instances.get(document.getElementById(id))?.button.focus();
        });
      }
    }
    keydown(event) {
      if (event.isComposing) return;
      const isSearch = event.target === this.search;
      if (event.key === 'Tab') {
        if (opened === this) this.close(true);
        return; // Keep native tab navigation and the dialog focus trap.
      }
      if (event.key === 'Escape' && opened === this) {
        event.preventDefault(); event.stopPropagation(); this.close(true); return;
      }
      const navigate = ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key);
      const accept = event.key === 'Enter' || (!isSearch && event.key === ' ');
      if (!navigate && !accept) {
        if (!isSearch && event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          this.open();
          if (!this.search.hidden) {this.search.value = event.key; this.renderOptions();}
        }
        return;
      }
      if (isSearch && ['Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      if (opened !== this) {this.open(); return;}
      if (accept) {this.choose(this.active); return;}
      const enabled = this.visible.filter(option => !option.disabled);
      if (!enabled.length) return;
      let offset = enabled.findIndex(option => option.index === this.active);
      if (event.key === 'Home') offset = 0;
      else if (event.key === 'End') offset = enabled.length - 1;
      else offset = Math.max(0, Math.min(enabled.length - 1, offset + (event.key === 'ArrowDown' ? 1 : -1)));
      this.highlight(enabled[offset].index);
    }
    position() {
      if (!this.panel) return;
      const rect = this.button.getBoundingClientRect();
      const viewport = window.visualViewport;
      const width = viewport?.width || window.innerWidth, height = viewport?.height || window.innerHeight;
      const x = viewport?.offsetLeft || 0, y = viewport?.offsetTop || 0;
      if (rect.height && (rect.bottom < y || rect.top > y + height)) {this.close(); return;}
      const menuWidth = Math.min(Math.max(rect.width, 220), width - 24);
      const below = height + y - rect.bottom - 14, above = rect.top - y - 14;
      const up = below < 220 && above > below;
      const room = Math.max(80, Math.min(350, up ? above : below));
      this.panel.style.width = `${menuWidth}px`;
      this.panel.style.maxHeight = `${room}px`;
      this.panel.style.left = `${Math.max(x + 12, Math.min(rect.left, x + width - menuWidth - 12))}px`;
      const menuHeight = Math.min(this.panel.scrollHeight || room, room);
      this.panel.style.top = `${Math.max(y + 8, up ? rect.top - menuHeight - 6 : rect.bottom + 6)}px`;
      this.panel.dataset.side = up ? 'above' : 'below';
    }
    close(focus = false) {
      this.panel?.remove();
      this.panel = null;
      this.button.setAttribute('aria-expanded', 'false');
      this.button.removeAttribute('aria-controls');
      this.button.removeAttribute('aria-activedescendant');
      if (opened === this) opened = null;
      if (focus && this.button.isConnected) this.button.focus();
    }
    destroy() {
      this.close();
      this.select.classList.remove('book-select-native');
      for (const [key, value] of [['tabindex', this.originalTabIndex], ['aria-hidden', this.originalAriaHidden]]) {
        if (value === null) this.select.removeAttribute(key); else this.select.setAttribute(key, value);
      }
      if (this.wrapper.isConnected) {this.wrapper.before(this.select); this.wrapper.remove();}
      instances.delete(this.select);
    }
  }
  function enhance() {
    for (const [select, instance] of instances) {
      if (!select.isConnected || select.multiple || select.size > 1) instance.destroy();
    }
    document.querySelectorAll('select').forEach(select => {
      if (select.multiple || select.size > 1) return;
      if (!instances.has(select)) instances.set(select, new BookSelect(select));
      else instances.get(select).sync();
    });
  }
  function schedule() {
    if (queued) return;
    queued = true;
    queueMicrotask(() => {queued = false; enhance();});
  }
  const observer = new MutationObserver(records => {
    if (records.some(record => record.target.tagName === 'SELECT' || record.target.closest?.('select') ||
      [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 &&
        (node.matches('select,fieldset') || node.querySelector('select'))))) schedule();
    if (records.some(record => record.target.tagName === 'FIELDSET')) schedule();
    if (opened && !opened.select.isConnected) opened.close();
  });
  observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['disabled','selected','label','class','required','multiple','size']});
  document.addEventListener('change', event => {if (instances.has(event.target)) schedule();}, true);
  document.addEventListener('reset', () => setTimeout(schedule, 0), true);
  document.addEventListener('invalid', event => {
    const instance = instances.get(event.target);
    if (!instance) return;
    event.preventDefault();
    instance.button.setAttribute('aria-invalid', 'true');
    const firstInvalid = event.target.form && [...event.target.form.elements].find(control => control.willValidate && !control.validity.valid);
    if (!firstInvalid || firstInvalid === event.target) instance.button.focus();
  }, true);
  document.addEventListener('focusin', event => {
    const instance = instances.get(event.target);
    if (instance) instance.button.focus();
    if (opened && event.target !== opened.button && !opened.panel.contains(event.target)) opened.close();
  });
  document.addEventListener('click', event => {
    const label = event.target.closest('label');
    const instance = label?.control && instances.get(label.control);
    if (instance && !event.target.closest('button,input,a,.book-select-menu')) {
      event.preventDefault(); instance.button.focus(); instance.open();
    }
  });
  document.addEventListener('pointerdown', event => {
    if (opened && !opened.wrapper.contains(event.target) && !opened.panel.contains(event.target)) opened.close();
  }, true);
  document.addEventListener('scroll', event => {
    if (opened && !opened.panel.contains(event.target)) opened.position();
  }, true);
  window.addEventListener('resize', () => opened?.position());
  window.visualViewport?.addEventListener('resize', () => opened?.position());
  window.WorkbenchSelects = {enhance, close: () => opened?.close(), destroy: () => {
    observer.disconnect();
    for (const instance of [...instances.values()]) instance.destroy();
  }};
  enhance();
})();
