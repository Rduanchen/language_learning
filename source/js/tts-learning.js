(function () {
    // 從 URL 參數或 localStorage 中讀取調試設置
    const urlParams = new URLSearchParams(window.location.search);
    const debugParam = urlParams.get('debug');

    // 優先使用 URL 參數，其次使用 localStorage，默認為 false
    let DEBUG_MODE = debugParam === 'true' ? true :
        (debugParam === 'false' ? false :
            (localStorage.getItem('ttsLearningDebug') === 'true'));

    // 將當前設置保存到 localStorage
    if (debugParam) {
        localStorage.setItem('ttsLearningDebug', debugParam);
    }

    // 創建調試日誌函數
    window.ttsDebugLog = function (...args) {
        if (DEBUG_MODE) {
            console.log('[TTS Learning]', ...args);
        }
    };

    // 公開啟用/禁用調試的方法
    window.enableTTSDebug = function () {
        DEBUG_MODE = true;
        localStorage.setItem('ttsLearningDebug', 'true');
        console.log('[TTS Learning] Debug mode enabled');
    };

    window.disableTTSDebug = function () {
        DEBUG_MODE = false;
        localStorage.setItem('ttsLearningDebug', 'false');
        console.log('[TTS Learning] Debug mode disabled');
    };

    // 檢查當前模式
    window.isTTSDebugEnabled = function () {
        return DEBUG_MODE;
    };

    // 示例調試輸出
    ttsDebugLog('TTS Learning JS initialized, debug mode:', DEBUG_MODE);
})();

(function () {
    window.TTSLearningPlugin = class {
        constructor(container) {
            this.container = container;
            this.sentence = container.dataset.sentence;
            this.translation = container.dataset.translation;
            this.note = container.dataset.note;
            this.language = container.dataset.language || "en-US";

            this.mediaRecorder = null;
            this.audioChunks = [];
            this.recordedAudio = null;
            this.isRecording = false;
            this.voicesLoaded = false;
            this.availableVoice = null;

            this.init();
        }

        init() {
            this.render();
            this.bindEvents();
            this.checkBrowserSupport();
            this.waitForVoices();
            window.ttsDebugLog('TTS Learning Plugin initialized with language:', this.language);
        }

        // 等待語音載入並找到適合的語音
        waitForVoices() {
            const checkVoices = () => {
                const voices = window.speechSynthesis.getVoices();

                if (voices.length > 0) {
                    this.voicesLoaded = true;
                    this.findBestVoice(voices);
                    this.updateVoiceInfo();
                } else {
                    // 如果語音還沒載入，繼續等待
                    setTimeout(checkVoices, 100);
                }
            };

            checkVoices();

            // 也監聽 voiceschanged 事件
            if ("speechSynthesis" in window) {
                window.speechSynthesis.onvoiceschanged = () => {
                    const voices = window.speechSynthesis.getVoices();
                    if (voices.length > 0) {
                        this.voicesLoaded = true;
                        this.findBestVoice(voices);
                        this.updateVoiceInfo();
                    }
                };
            }
        }

        // 尋找最適合的語音
        findBestVoice(voices) {
            window.ttsDebugLog(`Looking for voice for language: ${this.language}`);
            window.ttsDebugLog(
                "Available voices:",
                voices.map((v) => `${v.name} (${v.lang})`)
            );

            const languageCode = this.language.split("-")[0]; // 例如: 'en', 'fr', 'es'

            // 優先級排序：
            // 1. 完全匹配 (例如: en-US 匹配 en-US)
            // 2. 語言匹配 (例如: en-US 匹配 en-GB)
            // 3. 本地語音優先

            let exactMatch = voices.find(
                (v) => v.lang.toLowerCase() === this.language.toLowerCase()
            );
            let languageMatch = voices.find((v) =>
                v.lang.toLowerCase().startsWith(languageCode.toLowerCase())
            );
            let localMatch = voices.find(
                (v) =>
                    v.lang.toLowerCase().startsWith(languageCode.toLowerCase()) &&
                    v.localService
            );

            this.availableVoice =
                exactMatch || localMatch || languageMatch || voices[0];

            window.ttsDebugLog(
                `Selected voice: ${this.availableVoice?.name} (${this.availableVoice?.lang})`
            );
        }

        updateVoiceInfo() {
            const voiceInfoElement = this.container.querySelector(".voice-info");
            if (voiceInfoElement && this.availableVoice) {
                if (!window.isTTSDebugEnabled()) {
                    voiceInfoElement.style.display = "block";
                    voiceInfoElement.textContent = ``;
                } else {
                    voiceInfoElement.textContent = `Using voice: ${this.availableVoice.name} (${this.availableVoice.lang})`;
                }
            }
        }

        render() {
            const words = this.sentence
                .split(" ")
                .map(
                    (word) =>
                        `<span class="word" data-word="${word.replace(
                            /[^\w\s\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g,
                            ""
                        )}">${word}</span>`
                )
                .join(" ");

            this.container.innerHTML = `
                    <div class="language-info">Language: ${this.language}</div>
                    <div class="voice-info">Loading voices...</div>
                    <div class="sentence-container">
                        <div class="sentence">${words}</div>
                        <div class="translation">${this.translation}</div>
                        ${this.note
                    ? `<div class="note">${this.note}</div>`
                    : ""
                }
                    </div>
                    <div class="controls">
                        <button class="btn btn-primary" id="speak-sentence">🔊 Speak Sentence</button>
                        <button class="btn btn-success" id="start-recording">🎤 Record</button>
                        <button class="btn btn-danger" id="stop-recording" disabled>⏹️ Stop</button>
                        <button class="btn btn-secondary" id="play-recording" disabled>▶️ Play Recording</button>
                        <!-- <button class="btn btn-secondary" id="debug-voices">🔍 Debug Voices</button> -->
                        <span class="recording-status" id="recording-status"></span>
                    </div>
                    <div class="audio-controls" id="audio-controls"></div>
                    <div class="error-message" id="error-message" style="display: none;"></div>
                    <div class="debug-info" id="debug-info" style="display: none;"></div>
                `;
        }

        bindEvents() {
            // Speak entire sentence
            this.container
                .querySelector("#speak-sentence")
                .addEventListener("click", () => {
                    this.speakText(this.sentence, this.language);
                });

            // Speak individual words
            this.container.querySelectorAll(".word").forEach((wordElement) => {
                wordElement.addEventListener("click", () => {
                    const word = wordElement.dataset.word;
                    if (word) {
                        this.speakText(word, this.language);
                    }
                });
            });

            // Debug voices button
            // this.container
            //     .querySelector("#debug-voices")
            //     .addEventListener("click", () => {
            //         this.showDebugInfo();
            //     });

            // Recording controls
            this.container
                .querySelector("#start-recording")
                .addEventListener("click", () => {
                    this.startRecording();
                });

            this.container
                .querySelector("#stop-recording")
                .addEventListener("click", () => {
                    this.stopRecording();
                });

            this.container
                .querySelector("#play-recording")
                .addEventListener("click", () => {
                    this.playRecording();
                });
        }

        // 改良的語音播放方法
        speakText(text, language = "en-US") {
            window.ttsDebugLog("Attempting to speak:", text, "in language:", language);

            if (!("speechSynthesis" in window)) {
                this.showError("Text-to-speech is not supported in this browser.");
                return;
            }

            // 確保先停止任何正在進行的語音
            window.speechSynthesis.cancel();

            // 等待一小段時間確保 cancel 完成
            setTimeout(() => {
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = language;
                utterance.rate = 0.8;
                utterance.pitch = 1;
                utterance.volume = 1;

                // 使用我們找到的最佳語音
                if (this.availableVoice) {
                    utterance.voice = this.availableVoice;
                    window.ttsDebugLog(
                        `Using voice: ${this.availableVoice.name} for language: ${language}`
                    );
                } else {
                    window.ttsDebugLog("No specific voice found, using default");
                }

                // 添加事件監聽器來調試
                utterance.onstart = () => {
                    window.ttsDebugLog("Speech started");
                };

                utterance.onend = () => {
                    window.ttsDebugLog("Speech ended");
                };

                utterance.onerror = (event) => {
                    console.error("Speech error:", event);
                    this.showError(`Speech error: ${event.error}`);
                };

                // 開始朗讀
                try {
                    window.speechSynthesis.speak(utterance);
                } catch (error) {
                    console.error("Error starting speech:", error);
                    this.showError(`Error starting speech: ${error.message}`);
                }
            }, 100);
        }

        showDebugInfo() {
            if (!window.isTTSDebugEnabled()) return;
            const debugElement = this.container.querySelector("#debug-info");
            const voices = window.speechSynthesis.getVoices();

            let debugHtml = `<strong>Debug Information:</strong><br>`;
            debugHtml += `Target Language: ${this.language}<br>`;
            debugHtml += `Selected Voice: ${this.availableVoice?.name || "None"
                } (${this.availableVoice?.lang || "N/A"})<br>`;
            debugHtml += `Total Available Voices: ${voices.length}<br><br>`;

            debugHtml += `<strong>All Available Voices:</strong><br>`;
            voices.forEach((voice, index) => {
                const isSelected = this.availableVoice === voice;
                debugHtml += `${index + 1}. ${voice.name} (${voice.lang}) ${voice.localService ? "[Local]" : "[Remote]"
                    } ${isSelected ? "<-- SELECTED" : ""}<br>`;
            });

            debugElement.innerHTML = debugHtml;
            debugElement.style.display =
                debugElement.style.display === "none" ? "block" : "none";
        }

        async startRecording() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    audio: true,
                });

                this.mediaRecorder = new MediaRecorder(stream);
                this.audioChunks = [];

                this.mediaRecorder.ondataavailable = (event) => {
                    this.audioChunks.push(event.data);
                };

                this.mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(this.audioChunks, {
                        type: "audio/wav",
                    });
                    const audioUrl = URL.createObjectURL(audioBlob);
                    this.recordedAudio = new Audio(audioUrl);

                    this.container.querySelector("#play-recording").disabled = false;
                    this.updateRecordingStatus("Recording saved!");

                    // Stop all tracks to release the microphone
                    stream.getTracks().forEach((track) => track.stop());
                };

                this.mediaRecorder.start();
                this.isRecording = true;

                this.container.querySelector("#start-recording").disabled = true;
                this.container.querySelector("#stop-recording").disabled = false;
                this.updateRecordingStatus("Recording...", "recording");
            } catch (error) {
                this.showError("Microphone access denied or not available.");
                console.error("Recording error:", error);
            }
        }

        stopRecording() {
            if (this.mediaRecorder && this.isRecording) {
                this.mediaRecorder.stop();
                this.isRecording = false;

                this.container.querySelector("#start-recording").disabled = false;
                this.container.querySelector("#stop-recording").disabled = true;
                this.updateRecordingStatus("Processing...", "");
            }
        }

        playRecording() {
            if (this.recordedAudio) {
                this.recordedAudio.play();
            }
        }

        updateRecordingStatus(message, className = "") {
            const statusElement =
                this.container.querySelector("#recording-status");
            statusElement.textContent = message;
            statusElement.className = `recording-status ${className}`;
        }

        showError(message) {
            const errorElement = this.container.querySelector("#error-message");
            errorElement.textContent = message;
            errorElement.style.display = "block";
            setTimeout(() => {
                errorElement.textContent = "";
                errorElement.style.display = "none";
            }, 5000);
        }

        checkBrowserSupport() {
            if (!("speechSynthesis" in window)) {
                this.showError("Text-to-speech is not supported in this browser.");
            }

            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                this.showError("Audio recording is not supported in this browser.");
                this.container.querySelector("#start-recording").disabled = true;
            }
        }
    }
})();