(() => {
  'use strict';
  const secondsInput = document.getElementById('seconds');
  const remainderInput = document.getElementById('remainder');
  const frames = document.getElementById('frames');
  const status = document.getElementById('status');
  const clean = value => value.normalize('NFKC').replace(/\s/g, '').replace(/fr$/i, '');
  const stepButtons = [...document.querySelectorAll('.stepper button')];

  function stepTotal(target) {
    try {
      const value = target === 'frames' ? frames.value || '0' : `${secondsInput.value || '0'}+${remainderInput.value || '0'}`;
      return BigInt(convert(value, target === 'frames' ? 'frames' : 'timing').frames);
    } catch { return null; }
  }

  function refreshSteppers() {
    for (const button of stepButtons) {
      const total = stepTotal(button.dataset.target);
      const amount = button.dataset.target === 'seconds' ? 24n : 1n;
      const next = total === null ? -1n : total + BigInt(button.dataset.delta) * amount;
      button.disabled = next < 0n || String(next).length > 48;
    }
  }

  function convert(value, direction) {
    const text = clean(value);
    if (!text) return null;
    if (text.length > 48) throw new Error('入力は48文字以内にしてください。');
    if (direction === 'timing') {
      const match = /^(\d+)\+(\d+)$/.exec(text);
      if (!match) throw new Error('「2+12」の形で入力してください。');
      const seconds = BigInt(match[1]);
      const remainder = BigInt(match[2]);
      const total = seconds * 24n + remainder;
      return { timing: `${total / 24n}+${total % 24n}`, frames: String(total), formula: `${seconds} × 24 + ${remainder} = ${total}Fr` };
    }
    if (!/^\d+$/.test(text)) throw new Error('0以上の整数を入力してください。');
    const total = BigInt(text);
    const seconds = total / 24n;
    const remainder = total % 24n;
    return { timing: `${seconds}+${remainder}`, frames: String(total), formula: `${seconds} × 24 + ${remainder} = ${total}Fr` };
  }

  function update(direction) {
    secondsInput.removeAttribute('aria-invalid');
    remainderInput.removeAttribute('aria-invalid');
    frames.removeAttribute('aria-invalid');
    status.classList.remove('error');
    try {
      const value = direction === 'timing' ? (secondsInput.value && remainderInput.value ? `${secondsInput.value}+${remainderInput.value}` : '') : frames.value;
      const result = convert(value, direction);
      if (direction === 'timing') {
        frames.value = result ? result.frames : '';
      } else {
        [secondsInput.value, remainderInput.value] = result ? result.timing.split('+') : ['', ''];
        secondsInput.dataset.valid = secondsInput.value;
        remainderInput.dataset.valid = remainderInput.value;
      }
      status.textContent = result ? result.formula : '';
      refreshSteppers();
      return result;
    } catch (error) {
      if (direction === 'timing') frames.value = '';
      else {
        secondsInput.value = '';
        remainderInput.value = '';
        secondsInput.dataset.valid = '';
        remainderInput.dataset.valid = '';
      }
      status.textContent = error.message;
      status.classList.add('error');
      if (direction === 'frames') frames.setAttribute('aria-invalid', 'true');
      refreshSteppers();
      return null;
    }
  }
  const digits = value => value.normalize('NFKC');
  for (const input of [secondsInput, remainderInput]) {
    input.dataset.valid = input.value;
    input.addEventListener('beforeinput', event => {
      if (event.data !== null && !/^\d*$/.test(digits(event.data))) event.preventDefault();
    });
    input.addEventListener('paste', event => {
      if (!/^\d*$/.test(digits(event.clipboardData.getData('text')))) event.preventDefault();
    });
    input.addEventListener('input', () => {
      const value = digits(input.value);
      if (!/^\d*$/.test(value)) { input.value = input.dataset.valid; return; }
      input.value = value;
      input.dataset.valid = value;
      update('timing');
    });
  }
  frames.addEventListener('input', () => update('frames'));
  for (const input of [secondsInput, remainderInput, frames]) {
    input.addEventListener('focus', () => input.select());
  }
  for (const button of stepButtons) {
    button.addEventListener('click', () => {
      const total = stepTotal(button.dataset.target);
      if (total === null) return;
      const amount = button.dataset.target === 'seconds' ? 24n : 1n;
      const next = total + BigInt(button.dataset.delta) * amount;
      if (next < 0n || String(next).length > 48) return;
      frames.value = String(next);
      update('frames');
    });
  }
  refreshSteppers();

  const context = document.modelContext;
  if (context?.registerTool) {
    const lifecycle = new AbortController();
    try {
      Promise.resolve(context.registerTool({
        name: 'convert_frames',
        title: 'コマ換算',
        description: '24fpsで秒＋コマ表記と総コマ数を相互変換し、入力欄を更新します。',
        inputSchema: { type: 'object', properties: { value: { type: 'string' }, direction: { type: 'string', enum: ['timing', 'frames'] } }, required: ['value', 'direction'], additionalProperties: false },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input.value !== 'string' || !['timing', 'frames'].includes(input.direction)) throw new Error('入力形式が正しくありません。');
          const result = convert(input.value, input.direction);
          if (!result) throw new Error('値を入力してください。');
          [secondsInput.value, remainderInput.value] = result.timing.split('+');
          secondsInput.dataset.valid = secondsInput.value;
          remainderInput.dataset.valid = remainderInput.value;
          frames.value = result.frames;
          status.textContent = result.formula;
          status.classList.remove('error');
          secondsInput.removeAttribute('aria-invalid');
          remainderInput.removeAttribute('aria-invalid');
          frames.removeAttribute('aria-invalid');
          refreshSteppers();
          return { timing: result.timing + 'Fr', frames: result.frames + 'Fr', fps: 24 };
        }
      }, { signal: lifecycle.signal })).catch(() => {});
    } catch {}
    window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
  }
})();
