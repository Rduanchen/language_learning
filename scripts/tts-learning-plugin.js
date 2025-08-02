'use strict';
const fs = require('fs');
const path = require('path');

const pluginConfig = hexo.config.tts_learning || {};
const DEBUG_MODE = pluginConfig.debug === true || hexo.env.debug;
const isDarkMode = pluginConfig.darkmode === true || hexo.theme.config.darkmode === true;
const URL_ROOT = hexo.config.root || '/';

function debugLog(...args) {
  if (DEBUG_MODE) {
    console.log('[TTS Learning]', ...args);
  }
}



function getKeyAndValue(sentence) {
  const regex = /^([^=]+)=(.*)$/;
  const match = sentence.match(regex);
  if (match) {
    const key = match[1];   // "sentence"
    const value = match[2]; // "Guten Tag, wie geht es Ihnen?"
    return { key, value };
  } else {
    return null;
  }
}

// 註冊標籤
hexo.extend.tag.register('tts_learning', function (args) {
  // 創建一個參數對象
  const params = {
    sentence: '',
    translation: '',
    note: '',
    language: 'en-US'
  };

  // 檢查是否使用了新的鍵值對格式
  const hasKeyValuePairs = args.some(arg => arg.includes('='));

  if (hasKeyValuePairs) {
    // 使用鍵值對解析
    args.forEach(arg => {
      const keyValue = getKeyAndValue(arg);
      if (keyValue) {
        // 將鍵值對賦值給參數對象
        const { key, value } = keyValue;
        if (key && value !== undefined) {
          // 將鍵轉為小寫以確保一致性
          const lowerKey = key.toLowerCase();
          params[lowerKey] = value;
          // 確保語言默認為 'en-US'，如果未提供則使用默認值
          if (lowerKey === 'language' && !value) {
            params.language = 'en-US';
          }
        }
      }
    });
  } else {
    // 使用舊的位置參數格式
    // 解析引號包圍的參數
    const processArgs = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (let arg of args) {
      if (!inQuote) {
        if ((arg.startsWith('"') && arg.endsWith('"')) ||
          (arg.startsWith("'") && arg.endsWith("'"))) {
          // 單個引號包圍的參數
          processArgs.push(arg.slice(1, -1));
        } else if (arg.startsWith('"') || arg.startsWith("'")) {
          // 引號開始
          inQuote = true;
          quoteChar = arg[0];
          current = arg.slice(1);
        } else {
          // 無引號參數
          processArgs.push(arg);
        }
      } else {
        if (arg.endsWith(quoteChar)) {
          // 引號結束
          inQuote = false;
          current += ' ' + arg.slice(0, -1);
          processArgs.push(current);
          current = '';
        } else {
          // 引號內的內容
          current += ' ' + arg;
        }
      }
    }

    // 賦值給參數對象
    if (processArgs.length > 0) params.sentence = processArgs[0];
    if (processArgs.length > 1) params.translation = processArgs[1];
    if (processArgs.length > 2) params.note = processArgs[2];
    if (processArgs.length > 3) params.language = processArgs[3];
  }

  // 生成唯一ID
  const id = `tts-learning-${Math.random().toString(36).substr(2, 9)}`;

  // 輸出調試信息
  debugLog('TTS Learning tag with parameters:', params);

  return `
    <div class="tts-learning-card"
         id="${id}"
         data-sentence="${params.sentence || ''}"
         data-translation="${params.translation || ''}"
         data-note="${params.note || ''}"
         data-language="${params.language || 'en-US'}">
    </div>
    <script>
      // let TTSLearningPlugin = window.TTSLearningPlugin || null;
      console.log('Initializing TTSLearningPlugin for element with ID:', '${id}');
      document.addEventListener('DOMContentLoaded', function() {
        if (typeof TTSLearningPlugin !== 'undefined') {
          new window.TTSLearningPlugin(document.getElementById('${id}'));
        } else {
          console.error('TTSLearningPlugin is not defined!');
        }
      });
    </script>
  `;
}, { ends: false });

// 強制確保 JS 和 CSS 文件被複製到輸出目錄
hexo.extend.generator.register('tts_learning_assets', function () {
  console.log(URL_ROOT);
  const jsPath = path.join(hexo.source_dir, `js/tts-learning.js`);
  let cssPath = path.join(hexo.source_dir, `css/tts-learning-bright.css`);
  if (isDarkMode) {
    cssPath = path.join(hexo.source_dir, `css/tts-learning-dark.css`);
    debugLog('Dark mode is enabled, using dark CSS:', cssPath);
  }

  const result = [];

  if (fs.existsSync(jsPath)) {
    result.push({
      path: 'js/tts-learning.js',
      data: fs.readFileSync(jsPath, 'utf8')
    });
    debugLog('JS file found and will be copied:', jsPath);
  } else {
    console.error('JS file not found at:', jsPath);
  }

  if (fs.existsSync(cssPath)) {
    result.push({
      path: 'css/tts-learning.css',
      data: fs.readFileSync(cssPath, 'utf8')
    });
    debugLog('CSS file found and will be copied:', cssPath);
  } else {
    console.error('CSS file not found at:', cssPath);
  }

  return result;
});

// 注入腳本與樣式到 HTML
hexo.extend.filter.register('after_render:html', function (str) {
  const scriptTag = `<script src="${URL_ROOT}js/tts-learning.js" defer></script>`;
  const styleTag = `<link rel="stylesheet" href="${URL_ROOT}css/tts-learning.css">`;

  debugLog('Injecting script and style tags...');

  // 確保腳本和樣式只被添加一次
  if (!str.includes('/js/tts-learning.js') && !str.includes('/css/tts-learning.css')) {
    return str
      .replace('</head>', `${styleTag}\n</head>`)
      .replace('</body>', `${scriptTag}\n</body>`);
  }

  return str;
});

debugLog('TTS Learning Plugin loaded successfully!');