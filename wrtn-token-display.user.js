// ==UserScript==
// @name         뤼튼 크랙 토큰 표시
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  뤼튼 크랙에서 AI 응답의 토큰 수를 표시합니다
// @author       케츠
// @match        https://crack.wrtn.ai/*
// @icon         https://crack.wrtn.ai/favicon.ico
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // 토큰 정보를 저장할 맵 (순서 기반으로 저장)
    const tokenData = new Map();
    const tokenHistory = [];
    
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
                    const turnId = data.data.turnId;
                    const createdAt = data.data.createdAt;
                    
                    // 토큰 정보를 순서대로 저장
                    const tokenInfo = {
                        messageId,
                        turnId,
                        tokenCount,
                        createdAt,
                        timestamp: Date.now()
                    };
                    
                    tokenHistory.push(tokenInfo);
                    tokenData.set(messageId, tokenInfo);
                    if (turnId) {
                        tokenData.set(turnId, tokenInfo);
                    }
                    
                    console.log('토큰 정보 수집:', tokenInfo);
                    
                    // DOM 업데이트 시도
                    setTimeout(() => updateTokenDisplayWithMatching(), 500);
                    setTimeout(() => updateTokenDisplayWithMatching(), 1000);
                    setTimeout(() => updateTokenDisplayWithMatching(), 2000);
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
                        const turnId = responseData.data.turnId;
                        const createdAt = responseData.data.createdAt;
                        
                        const tokenInfo = {
                            messageId,
                            turnId,
                            tokenCount,
                            createdAt,
                            timestamp: Date.now()
                        };
                        
                        tokenHistory.push(tokenInfo);
                        tokenData.set(messageId, tokenInfo);
                        if (turnId) {
                            tokenData.set(turnId, tokenInfo);
                        }
                        
                        console.log('XHR 토큰 정보 수집:', tokenInfo);
                        
                        setTimeout(() => updateTokenDisplayWithMatching(), 500);
                        setTimeout(() => updateTokenDisplayWithMatching(), 1000);
                        setTimeout(() => updateTokenDisplayWithMatching(), 2000);
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
    
    function updateTokenDisplay() {
        console.log('updateTokenDisplay 호출됨');
        console.log('현재 저장된 토큰 데이터:', Array.from(tokenData.entries()));
        console.log('토큰 히스토리 (순서대로):', tokenHistory);
        
        // 모든 AI 메시지 헤더 찾기
        const messageHeaders = document.querySelectorAll('div[display="flex"][class*="css-1q60mcv"]');
        console.log('찾은 메시지 헤더 개수:', messageHeaders.length);
        
        // AI 메시지만 필터링
        const aiHeaders = [];
        messageHeaders.forEach((header, index) => {
            const modelImg = header.querySelector('img[alt="model"]');
            if (modelImg) {
                aiHeaders.push({ header, originalIndex: index });
            }
        });
        
        console.log('AI 메시지 개수:', aiHeaders.length);
        
        aiHeaders.forEach(({ header, originalIndex }, aiIndex) => {
            console.log(`AI 헤더 ${aiIndex} (원본 ${originalIndex}) 처리 중:`, header);
            
            // 이미 토큰 표시가 있는지 확인
            if (header.querySelector('.token-display')) {
                console.log(`AI 헤더 ${aiIndex}: 이미 토큰 표시 존재`);
                return;
            }
            
            console.log(`AI 헤더 ${aiIndex}: AI 메시지 확인됨`);
            
            // 순서 기반으로 토큰 정보 매칭
            let tokenInfo = null;
            if (tokenHistory.length > aiIndex) {
                // 순서대로 토큰 할당
                tokenInfo = tokenHistory[aiIndex];
                console.log(`AI 헤더 ${aiIndex}: 순서 매칭 토큰 사용`, tokenInfo);
            } else if (tokenHistory.length > 0) {
                // 토큰 히스토리가 부족하면 역순으로 할당
                const reverseIndex = tokenHistory.length - 1 - (aiHeaders.length - 1 - aiIndex);
                if (reverseIndex >= 0) {
                    tokenInfo = tokenHistory[reverseIndex];
                    console.log(`AI 헤더 ${aiIndex}: 역순 매칭 토큰 사용`, tokenInfo);
                } else {
                    tokenInfo = tokenHistory[tokenHistory.length - 1];
                    console.log(`AI 헤더 ${aiIndex}: 마지막 토큰 사용`, tokenInfo);
                }
            }
            
            const tokenCount = tokenInfo ? tokenInfo.tokenCount : null;
            console.log(`AI 헤더 ${aiIndex}: 사용할 토큰 수:`, tokenCount);
            
            if (tokenCount !== null && tokenCount > 0) {
                // 토큰 표시 요소 생성
                const tokenDisplay = document.createElement('span');
                tokenDisplay.className = 'token-display';
                tokenDisplay.style.cssText = `
                    color: var(--text_quaternary);
                    font-size: 12px;
                    font-weight: 500;
                    margin-left: 6px;
                    opacity: 0.8;
                `;
                tokenDisplay.textContent = `${tokenCount}토큰`;
                
                // 헤더에 추가
                header.appendChild(tokenDisplay);
                
                console.log(`AI 헤더 ${aiIndex}: 토큰 표시 추가:`, tokenCount);
            }
        });
    }
    
    // 더 정확한 토큰 매칭을 위한 개선된 함수
    function updateTokenDisplayWithMatching() {
        console.log('updateTokenDisplayWithMatching 호출됨');
        console.log('현재 저장된 토큰 데이터:', Array.from(tokenData.entries()));
        console.log('토큰 히스토리:', tokenHistory);
        
        // 모든 AI 메시지 헤더 찾기
        const messageHeaders = document.querySelectorAll('div[display="flex"][class*="css-1q60mcv"]');
        console.log('찾은 메시지 헤더 개수:', messageHeaders.length);
        
        // AI 메시지만 필터링하고 역순으로 처리 (최신 메시지부터)
        const aiHeaders = [];
        messageHeaders.forEach((header, index) => {
            const modelImg = header.querySelector('img[alt="model"]');
            if (modelImg && !header.querySelector('.token-display')) {
                aiHeaders.push({ header, originalIndex: index });
            }
        });
        
        console.log('처리할 AI 메시지 개수:', aiHeaders.length);
        
        // 역순으로 처리하여 최신 메시지에 최신 토큰 매칭
        aiHeaders.reverse().forEach((aiHeader, reverseIndex) => {
            const { header, originalIndex } = aiHeader;
            const aiIndex = aiHeaders.length - 1 - reverseIndex;
            
            console.log(`AI 헤더 ${aiIndex} (역순 ${reverseIndex}) 처리 중:`, header);
            
            // 토큰 히스토리에서 해당하는 토큰 찾기
            let tokenInfo = null;
            if (tokenHistory.length > reverseIndex) {
                // 역순으로 토큰 할당 (최신 메시지 = 최신 토큰)
                tokenInfo = tokenHistory[tokenHistory.length - 1 - reverseIndex];
                console.log(`AI 헤더 ${aiIndex}: 역순 매칭 토큰 사용`, tokenInfo);
            } else if (tokenHistory.length > 0) {
                // 토큰이 부족하면 순환하여 할당
                const cycleIndex = reverseIndex % tokenHistory.length;
                tokenInfo = tokenHistory[tokenHistory.length - 1 - cycleIndex];
                console.log(`AI 헤더 ${aiIndex}: 순환 매칭 토큰 사용`, tokenInfo);
            }
            
            const tokenCount = tokenInfo ? tokenInfo.tokenCount : null;
            console.log(`AI 헤더 ${aiIndex}: 사용할 토큰 수:`, tokenCount);
            
            if (tokenCount !== null && tokenCount > 0) {
                // 토큰 표시 요소 생성
                const tokenDisplay = document.createElement('span');
                tokenDisplay.className = 'token-display';
                tokenDisplay.style.cssText = `
                    color: var(--text_quaternary);
                    font-size: 12px;
                    font-weight: 500;
                    margin-left: 6px;
                    opacity: 0.8;
                `;
                tokenDisplay.textContent = `${tokenCount}토큰`;
                
                // 헤더에 추가
                header.appendChild(tokenDisplay);
                
                console.log(`AI 헤더 ${aiIndex}: 토큰 표시 추가:`, tokenCount);
            }
        });
    }
    
    function updateTokenDisplayImproved() {
        const messageContainers = document.querySelectorAll('div[class*="css-16vasaf"]');
        
        messageContainers.forEach(container => {
            const header = container.querySelector('div[display="flex"][class*="css-1q60mcv"]');
            if (!header) return;
            
            // 이미 토큰 표시가 있는지 확인
            if (header.querySelector('.token-display')) return;
            
            // AI 메시지인지 확인 (모델 아이콘 존재)
            const modelImg = header.querySelector('img[alt="model"]');
            if (!modelImg) return;
            
            // 메시지 내용에서 특정 패턴 찾기 (더 정확한 매칭을 위해)
            const messageContent = container.querySelector('[class*="css-l6zbeu"], [class*="css-ujv7vi"]');
            if (!messageContent) return;
            
            // 가장 최근 토큰 정보 사용
            const tokenEntries = Array.from(tokenData.entries());
            if (tokenEntries.length === 0) return;
            
            const latestToken = tokenEntries[tokenEntries.length - 1][1];
            
            if (latestToken > 0) {
                const tokenDisplay = document.createElement('span');
                tokenDisplay.className = 'token-display';
                tokenDisplay.style.cssText = `
                    color: var(--text_quaternary);
                    font-size: 12px;
                    font-weight: 500;
                    margin-left: 6px;
                    opacity: 0.8;
                `;
                tokenDisplay.textContent = `${latestToken}토큰`;
                
                header.appendChild(tokenDisplay);
                console.log('토큰 표시 추가:', latestToken);
            }
        });
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
                    updateTokenDisplayWithMatching();
                    updateTokenDisplay();
                    updateTokenDisplayImproved();
                }, 100);
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 테스트용 토큰 데이터 추가 (임시)
    function addTestTokenData() {
        const testTokens = [
            { messageId: 'test1', turnId: 'turn1', tokenCount: 450, createdAt: new Date().toISOString(), timestamp: Date.now() - 3000 },
            { messageId: 'test2', turnId: 'turn2', tokenCount: 520, createdAt: new Date().toISOString(), timestamp: Date.now() - 2000 },
            { messageId: 'test3', turnId: 'turn3', tokenCount: 680, createdAt: new Date().toISOString(), timestamp: Date.now() - 1000 },
            { messageId: 'test4', turnId: 'turn4', tokenCount: 590, createdAt: new Date().toISOString(), timestamp: Date.now() }
        ];
        
        testTokens.forEach(tokenInfo => {
            tokenHistory.push(tokenInfo);
            tokenData.set(tokenInfo.messageId, tokenInfo);
            tokenData.set(tokenInfo.turnId, tokenInfo);
        });
        
        console.log('테스트 토큰 데이터 추가됨:', Array.from(tokenData.entries()));
        console.log('테스트 토큰 히스토리:', tokenHistory);
    }

    // 페이지 로드 완료 후 실행
    function init() {
        console.log('뤼튼 크랙 토큰 표시 확장 프로그램 시작');
        
        // 테스트용 토큰 데이터 추가 (네트워크 가로채기가 작동하지 않을 경우 확인용)
        setTimeout(() => {
            addTestTokenData();
            updateTokenDisplayWithMatching();
        }, 2000);
        
        // 초기 토큰 표시 업데이트
        setTimeout(() => {
            updateTokenDisplayWithMatching();
            updateTokenDisplay();
            updateTokenDisplayImproved();
        }, 1000);
        
        // DOM 변화 감지 시작
        startObserver();
        
        // 주기적 업데이트 (리롤 등의 경우를 위해)
        setInterval(() => {
            updateTokenDisplayWithMatching();
        }, 3000);
        
        // 네트워크 요청 모니터링 확인
        console.log('원본 fetch 함수:', originalFetch);
        console.log('현재 fetch 함수:', window.fetch);
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
