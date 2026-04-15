function bufferToBits(buffer) {
  const bytes = new Uint8Array(buffer);
  const bits = [];
  for (let i = 0; i < bytes.length; i++) {
    let byte = bytes[i];
    for (let j = 7; j >= 0; j--) {
      bits.push((byte >> j) & 1);
    }
  }
  return bits;
}

// Преобразует массив битов в Uint8Array (дополнение до байта не требуется, длина кратна 8)
function bitsToBytes(bits) {
  const byteLength = Math.ceil(bits.length / 8);
  const bytes = new Uint8Array(byteLength);
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === 1) {
      const byteIdx = Math.floor(i / 8);
      const bitPos = 7 - (i % 8);
      bytes[byteIdx] |= (1 << bitPos);
    }
  }
  return bytes;
}

// Получить строковое представление байтов (первые N байт и последние M байт) из массива битов
function formatBitsPreview(bits, firstBytes = 10, lastBytes = 5) {
  if (!bits.length) return "(пусто)";
  const totalBytes = Math.ceil(bits.length / 8);
  const bytes = [];
  for (let i = 0; i < totalBytes; i++) {
    let byteVal = 0;
    for (let b = 0; b < 8; b++) {
      const bitIdx = i * 8 + b;
      if (bitIdx < bits.length && bits[bitIdx] === 1) {
        byteVal |= (1 << (7 - b));
      }
    }
    bytes.push(byteVal);
  }

  const formatByte = (b) => b.toString(2).padStart(8, '0');
  let result = [];
  const firstCount = Math.min(firstBytes, bytes.length);
  for (let i = 0; i < firstCount; i++) result.push(formatByte(bytes[i]));

  if (bytes.length > firstBytes + lastBytes) {
    result.push('...');
    const startLast = bytes.length - lastBytes;
    for (let i = startLast; i < bytes.length; i++) result.push(formatByte(bytes[i]));
  } else if (bytes.length > firstBytes) {
    for (let i = firstBytes; i < bytes.length; i++) result.push(formatByte(bytes[i]));
  }
  return result.join(' ');
}

/**
 * Генерирует ключевой поток битов длины requiredLength
 * на основе начального состояния initialState (массив 0/1 длины 36)
 * @param {number[]} initialState - 36 битов
 * @param {number} requiredLength - нужное количество битов ключа
 * @returns {number[]} массив битов (0/1) длины requiredLength
 */
function generateKey(initialState, requiredLength) {
  const MAX_DEGREE = 36;
  const FIRST_DEGREE = 11;

  const keyWindow = [...initialState, 0].reverse(); // добавляем поле xor и переворачиваем
  const key = [];
  for (let i = 0; i < requiredLength; i++) {
    key.push(keyWindow[MAX_DEGREE]);
    keyWindow[0] = keyWindow[MAX_DEGREE] ^ keyWindow[FIRST_DEGREE];
    for (let j = MAX_DEGREE - 1; j >= 0; j--) {
      keyWindow[j + 1] = keyWindow[j];
    }
  }
  return key;
}

/**
 * Шифрование (XOR) – поточное
 * @param {number[]} plainBits - исходные биты
 * @param {number[]} keyBits - ключевые биты (та же длина)
 * @returns {number[]} зашифрованные биты
 */
function encryptBits(plainBits, keyBits) {
  const result = [];
  for (let i = 0; i < plainBits.length; i++) {
    result.push(plainBits[i] ^ keyBits[i]);
  }
  return result;
}

// ---------- ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ И ЛОГИКА UI ----------
let currentFileBits = [];       // биты загруженного файла
let currentKeyBits = [];        // сгенерированный ключ (после нажатия)
let currentResultBits = [];

const initialStateInput = document.getElementById('initialState');
const stateLenMsg = document.getElementById('stateLenMsg');
const stateValidMsg = document.getElementById('stateValidMsg');
const fileInput = document.getElementById('fileInput');
const fileNameSpan = document.getElementById('fileName');
const processBtn = document.getElementById('processBtn');
const originalPreviewDiv = document.getElementById('originalPreview');
const keyPreviewDiv = document.getElementById('keyPreview');
const resultPreviewDiv = document.getElementById('resultPreview');
const downloadArea = document.getElementById('downloadArea');

// валидация начального состояния (ровно 36 бит, только 0/1)
function validateInitialState() {
  let val = initialStateInput.value;
  val = val.replace(/[^01]/g, '');
  if (val.length > 36) val = val.slice(0, 36);
  initialStateInput.value = val;
  const len = val.length;
  stateLenMsg.textContent = `Символов введено: ${len}`;
  const valid = (len === 36 && /^[01]{36}$/.test(val));
  if (valid) {
    stateValidMsg.textContent = '✓ валидно (36 бит)';
    stateValidMsg.style.background = '#d1fae5';
    stateValidMsg.style.color = '#065f46';
  } else {
    stateValidMsg.textContent = len === 36 ? '⚠️ содержит не 0/1' : '✗ нужно ровно 36 битов';
    stateValidMsg.style.background = '#fee2e2';
    stateValidMsg.style.color = '#991b1b';
  }
  return valid;
}

initialStateInput.addEventListener('input', validateInitialState);
validateInitialState();

// загрузка файла
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) {
    fileNameSpan.textContent = 'Файл не выбран';
    currentFileBits = [];
    originalPreviewDiv.textContent = '— не загружен —';
    return;
  }
  fileNameSpan.textContent = file.name;
  const buffer = await file.arrayBuffer();
  currentFileBits = bufferToBits(buffer);
  const preview = formatBitsPreview(currentFileBits, 10, 5);
  originalPreviewDiv.textContent = preview || '(пустой файл)';
});

// обработка (шифрование)
processBtn.addEventListener('click', () => {
  if (!validateInitialState()) {
    alert('Начальное состояние должно быть ровно 36 битов (0/1)');
    return;
  }
  if (currentFileBits.length === 0) {
    alert('Сначала выберите файл');
    return;
  }

  const initialStateStr = initialStateInput.value;
  const initialState = initialStateStr.split('').map(ch => (ch === '1' ? 1 : 0));
  const requiredLength = currentFileBits.length;

  currentKeyBits = generateKey(initialState, requiredLength);
  currentResultBits = encryptBits(currentFileBits, currentKeyBits);

  // отображение превью ключа и результата
  const keyPreview = formatBitsPreview(currentKeyBits, 10, 5);
  const resultPreview = formatBitsPreview(currentResultBits, 10, 5);
  keyPreviewDiv.textContent = keyPreview || '(ключ пуст)';
  resultPreviewDiv.textContent = resultPreview || '(результат пуст)';

  // создание файла для скачивания с сохранением исходного формата
  const resultBytes = bitsToBytes(currentResultBits);
  const blob = new Blob([resultBytes], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  // Получаем исходное имя файла и формируем новое с суффиксом _encrypted
  const originalFile = fileInput.files[0];
  let outputFileName = 'encrypted_output.bin';
  if (originalFile) {
    const originalName = originalFile.name;
    const lastDot = originalName.lastIndexOf('.');
    if (lastDot !== -1) {
      const base = originalName.substring(0, lastDot);
      const ext = originalName.substring(lastDot);
      outputFileName = base + '_encrypted' + ext;
    } else {
      outputFileName = originalName + '_encrypted';
    }
  }

  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = outputFileName;
  downloadLink.textContent = '💾 Скачать зашифрованный файл';
  downloadLink.className = 'download-link';

  // Чтобы окно сохранения открывалось, НЕ отзываем URL сразу
  downloadLink.onclick = () => {
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  downloadArea.innerHTML = '';
  downloadArea.appendChild(downloadLink);
});
