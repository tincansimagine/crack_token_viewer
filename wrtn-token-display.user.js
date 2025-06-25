// ==UserScript==
// @name         뤼튼 크랙 토큰 표시
// @namespace    http://tampermonkey.net/
// @version      1.0.1
// @description  뤼튼 크랙에서 AI 응답의 토큰 수를 표시합니다
// @author       케츠
// @match        https://crack.wrtn.ai/*
// @icon         https://crack.wrtn.ai/favicon.ico
// @updateURL    https://github.com/tincansimagine/crack_token_viewer/raw/refs/heads/main/wrtn-token-display.user.js
// @downloadURL  https://github.com/tincansimagine/crack_token_viewer/raw/refs/heads/main/wrtn-token-display.user.js
// @grant        none
// @license      MIT
// ==/UserScript==
(function() {
    'use strict';

    // 가장 최신 토큰 정보만 저장
    let latestTokenInfo = null;
    let lastProcessedMessageId = null;

    // 네트워크 요청 가로채기 (fetch)
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const response = await originalFetch.apply(this, args);
        console.log('Fetch 요청 감지:', response.url);

        if (response.url.includes('contents-api.wrtn.ai') && response.url.includes('/result')) {
            console.log('토큰 API 응답 감지:', response.url);
            const clonedResponse = response.clone();
            try {
                const data = await clonedResponse.json();
                console.log('API 응답 데이터:', data);

                if (data.result === 'SUCCESS' && data.data && data.data.tokens) {
                    const messageId = data.data._id;
                    const tokenCount = data.data.tokens.find(token => token.type === 'text')?.count || 0;

                    // 가장 최신 토큰 정보만 저장
                    latestTokenInfo = {
                        messageId,
                        tokenCount,
                        timestamp: Date.now()
                    };

                    console.log('최신 토큰 정보 수집:', latestTokenInfo);

                    // 모든 기존 토큰 표시 제거 후 최신 것만 추가 (스트리밍 완료 대기)
                    setTimeout(() => {
                        removeAllTokenDisplays();
                        addTokenToLatestMessage();
                    }, 1500); // 스트리밍 완료를 위해 지연 시간 증가
                }
            } catch (e) {
                console.error('API 응답 파싱 오류:', e);
            }
        }

        return response;
    };

    // XMLHttpRequest도 가로채기
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
        this._url = url;
        return originalXHROpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(data) {
        const xhr = this;

        const originalOnLoad = xhr.onload;
        xhr.onload = function() {
            if (xhr._url && xhr._url.includes('contents-api.wrtn.ai') && xhr._url.includes('/result')) {
                console.log('XHR 토큰 API 응답 감지:', xhr._url);
                try {
                    const responseData = JSON.parse(xhr.responseText);
                    console.log('XHR API 응답 데이터:', responseData);

                    if (responseData.result === 'SUCCESS' && responseData.data && responseData.data.tokens) {
                        const messageId = responseData.data._id;
                        const tokenCount = responseData.data.tokens.find(token => token.type === 'text')?.count || 0;

                        // 가장 최신 토큰 정보만 저장
                        latestTokenInfo = {
                            messageId,
                            tokenCount,
                            timestamp: Date.now()
                        };

                        console.log('XHR 최신 토큰 정보 수집:', latestTokenInfo);

                        setTimeout(() => {
                            removeAllTokenDisplays();
                            addTokenToLatestMessage();
                        }, 1500);
                    }
                } catch (e) {
                    console.error('XHR API 응답 파싱 오류:', e);
                }
            }

            if (originalOnLoad) {
                originalOnLoad.apply(this, arguments);
            }
        };

        return originalXHRSend.apply(this, arguments);
    };

    // DOM 변화 감지를 위한 observer
    let observer;



    // 모든 토큰 표시 제거
    function removeAllTokenDisplays() {
        const allTokenDisplays = document.querySelectorAll('.token-display');
        allTokenDisplays.forEach(display => display.remove());
        console.log('모든 토큰 표시 제거됨:', allTokenDisplays.length);
    }

    // 가장 최신 메시지에만 토큰 추가 (지연 처리로 스트리밍 완료 후 적용)
    function addTokenToLatestMessage() {
        if (!latestTokenInfo || latestTokenInfo.tokenCount <= 0) {
            console.log('토큰 정보가 없거나 유효하지 않음');
            return;
        }

        // 스트리밍이 완료될 때까지 여러 번 시도
        let attemptCount = 0;
        const maxAttempts = 10;

        function tryAddToken() {
            attemptCount++;
            console.log(`토큰 추가 시도 ${attemptCount}/${maxAttempts}`);

            // 모든 AI 메시지 헤더 찾기 (DOM에서 실제 순서대로)
            const allMessageContainers = document.querySelectorAll('div[class*="css-16vasaf"]');
            let targetContainer = null;

            // 역순으로 검색하여 가장 마지막 AI 메시지 찾기
            for (let i = allMessageContainers.length - 1; i >= 0; i--) {
                const container = allMessageContainers[i];
                const header = container.querySelector('div[display="flex"][class*="css-1q60mcv"]');
                const modelImg = header?.querySelector('img[alt="model"]');

                if (header && modelImg) {
                    // 스트리밍 중인지 확인 (메시지 내용이 계속 변하고 있는지)
                    const messageContent = container.querySelector('[class*="css-l6zbeu"], [class*="css-ujv7vi"]');

                    // 스트리밍이 완료된 메시지인지 확인 (더 이상 변하지 않는지)
                    if (messageContent && messageContent.textContent.length > 0) {
                        targetContainer = container;
                        break;
                    }
                }
            }

            if (!targetContainer) {
                console.log('AI 메시지를 찾을 수 없음');
                if (attemptCount < maxAttempts) {
                    setTimeout(tryAddToken, 500);
                }
                return;
            }

            const header = targetContainer.querySelector('div[display="flex"][class*="css-1q60mcv"]');
            if (!header) {
                console.log('헤더를 찾을 수 없음');
                if (attemptCount < maxAttempts) {
                    setTimeout(tryAddToken, 500);
                }
                return;
            }

            // 이미 토큰 표시가 있는지 확인
            if (header.querySelector('.token-display')) {
                console.log('이미 토큰 표시 존재');
                return;
            }

            console.log('가장 최신 AI 메시지에 토큰 표시 추가:', latestTokenInfo.tokenCount);

            // 토큰 표시 요소 생성
            const tokenDisplay = document.createElement('span');
            tokenDisplay.className = 'token-display';
            tokenDisplay.setAttribute('data-message-id', latestTokenInfo.messageId);
            tokenDisplay.setAttribute('data-timestamp', latestTokenInfo.timestamp);

            const isMobile = window.innerWidth <= 768;

            // PC와 모바일 모두 동일한 스타일 적용 (자연스러운 배치)
            tokenDisplay.style.cssText = `
                color: var(--text_quaternary);
                font-size: ${isMobile ? '11px' : '12px'};
                font-weight: 500;
                margin-left: 6px;
                opacity: 0.8;
            `;

            tokenDisplay.textContent = `${latestTokenInfo.tokenCount}토큰`;
            header.appendChild(tokenDisplay);

            // 처리된 메시지 ID 기록
            lastProcessedMessageId = latestTokenInfo.messageId;

            console.log('토큰 표시 추가 완료:', latestTokenInfo.tokenCount);
        }

        // 즉시 시도하고, 실패하면 지연 후 재시도
        tryAddToken();
    }



    // DOM 변화 감지
    function startObserver() {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;

            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // 새로운 메시지가 추가되었는지 확인
                            if (node.matches && (
                                node.matches('div[class*="css-16vasaf"]') ||
                                node.querySelector && node.querySelector('div[class*="css-16vasaf"]')
                            )) {
                                shouldUpdate = true;
                            }
                        }
                    });
                }
            });

            if (shouldUpdate) {
                setTimeout(() => {
                    if (latestTokenInfo) {
                        removeAllTokenDisplays();
                        addTokenToLatestMessage();
                    }
                }, 800);
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }



    // 페이지 로드 완료 후 실행
    function init() {
        console.log('뤼튼 크랙 토큰 표시 확장 프로그램 시작');

        // 모든 토큰 표시 제거 (새로고침 시)
        removeAllTokenDisplays();

        // 토큰 정보 초기화
        latestTokenInfo = null;
        lastProcessedMessageId = null;

        // DOM 변화 감지 시작
        startObserver();

        console.log('초기화 완료');
    }

    // 페이지 로드 상태 확인 후 초기화
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 페이지 변화 감지 (SPA 대응)
    let currentUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== currentUrl) {
            currentUrl = location.href;
            // URL 변경 시 재초기화
            setTimeout(init, 1000);
        }
    }).observe(document, { subtree: true, childList: true });

})();
