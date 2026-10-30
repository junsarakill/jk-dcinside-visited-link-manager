// ==UserScript==
// @name         DCInside Visited Link Manager
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  디시 url 방문 기록을 수집하여 페이지에 반영
// @author       JKAKK
// @match        https://gall.dcinside.com/*
// @updateURL    https://raw.githubusercontent.com/junsarakill/jk-dcinside-visited-link-manager/main/JKDVLM.user.js
// @downloadURL  https://raw.githubusercontent.com/junsarakill/jk-dcinside-visited-link-manager/main/JKDVLM.user.js
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // [Logger & Config Management]
    // ==========================================
    const CONFIG = {
        // 디버깅 로그 활성화 여부
        isDebug: false
        ,STORAGE_KEY: 'dc_visited_posts_store'
        ,EXPIRY_DAYS: 90
        ,EXPIRY_TIME: 90 * 24 * 60 * 60 * 1000
        // url 체크 타이머 간격 ms
        ,urlCheckInterval: 200
        ,visitedColor: '#795091'
        
    };

    /**
     * 전용 디버그 로거
     */
    function log(msg) 
    {
        if (CONFIG.isDebug) 
        {
            const now = new Date();
            const timeStr = now.toTimeString().split(' ')[0]; // "HH:MM:SS" 형식 추출
            console.log(`[JKDVLM] [${timeStr}]\n${msg}`);
        }
    }

    log("스크립트 작동")

    /**
     * 스토리지를 불러오고, 90일이 지난 오래된 방문 기록을 자동 청소(Purge)합니다.
     */
    function loadAndCleanStorage() {
        // GM_getValue로 가져온 값을 구조분해 할당이나 JSON 변환을 통해 
    // 이전 메모리 캐시와의 연결을 완전히 끊고 새로운 객체로 할당받습니다.
    let rawData = GM_getValue(CONFIG.STORAGE_KEY, {});
    log(`doremi rawdata ${Object.keys(rawData).length}개`)
    let visitedMap = JSON.parse(JSON.stringify(rawData));
        const now = Date.now();
        let isModified = false;
        let cleanedCount = 0;

        for (const key in visitedMap) {
            if (now - visitedMap[key] > CONFIG.EXPIRY_TIME) {
                delete visitedMap[key];
                isModified = true;
                cleanedCount++;
            }
        }

        if (isModified) {
            GM_setValue(CONFIG.STORAGE_KEY, visitedMap);
            log(`[Storage] 만료된 기록 ${cleanedCount}개 자동 청소 완료`);
        }

        return visitedMap;
    }

    /**
     * 방문 기록 스토리지에 특정 글을 저장합니다.
     */
    function saveVisitedPost(galleryId, postNo) {
        if (!galleryId || !postNo) return;

        const key = `${galleryId}_${postNo}`;
        let visitedMap = loadAndCleanStorage();

        if (!visitedMap[key]) {
            visitedMap[key] = Date.now();
            GM_setValue(CONFIG.STORAGE_KEY, visitedMap);
            log(`[Tracker] 새 글 방문 기록 저장 성공 -> 갤러리: ${galleryId}, 글번호: ${postNo}`);
        } else {
            log(`[Tracker] 이미 기록되어 있는 글 -> 갤러리: ${galleryId}, 글번호: ${postNo}`);
        }
    }


    // ==========================================
    // [Core Feature 1: 방문 감지 및 수집]
    // 개별 글 보기 페이지 진입 시 실행
    // ==========================================
    function initPostTracker() {
        if (!location.pathname.includes('/board/view/')) return;

        log('[Tracker] 개별 글 보기 페이지 진입 감지');

        const urlParams = new URLSearchParams(location.search);
        const galleryId = urlParams.get('id');
        const postNo = urlParams.get('no');

        log(`[Tracker] 파싱된 정보 - id: ${galleryId}, no: ${postNo}`);
        saveVisitedPost(galleryId, postNo);
    }

        // 변경 후 (v0.4)
    function injectCustomCSS() {
        if (document.getElementById('jk-visited-style')) return;

        const style = document.createElement('style');
        style.id = 'jk-visited-style';
        style.innerHTML = `
            a.jk-custom-visited, 
            a.jk-custom-visited *, 
            a.jk-custom-visited:visited, 
            a.jk-custom-visited:visited *, 
            a.jk-custom-visited:link,
            a.jk-custom-visited:link * {
                color: ${CONFIG.visitedColor} !important;
            }
        `;
        document.head.appendChild(style);
        log('[CSS] 커스텀 방문 링크 스타일 주입 완료');
    }


    // ==========================================
    // [Core Feature 2: 목록 페이지 CSS 스타일 주입]
    // 게시물 목록 조회 시 방문한 링크에 보라색 스타일 적용
    // ==========================================
    function initListViewStyler() 
    {
        // 디시인사이드는 목록 경로가 환경에 따라 다를 수 있으므로 폭넓게 체크
        if (!location.pathname.includes('/board/lists/') && !location.pathname.includes('/board/board/') && !location.pathname.includes('/board/view/')) {
            // 메인이나 기타 페이지일 수 있음
        }

        log('[Styler] 목록 페이지 스타일러 초기화 시작');
        
        // 정의만 되어있던 CSS 주입 함수를 여기서 실행하도록 추가
        injectCustomCSS();

        const visitedMap = loadAndCleanStorage();
        log(`[Styler] 스토리지에 적재된 총 방문 기록 수: ${Object.keys(visitedMap).length}개`);

        /**
         * 컨테이너 내의 게시물 링크들을 순회하며 방문 기록 대조 후 CSS 적용
         */
        function applyVisitedStyles(rootElement) {
            const containers = rootElement.querySelectorAll ? [rootElement] : rootElement;
            let matchCount = 0;

            containers.forEach(container => {
                const links = container.querySelectorAll('a[href*="/board/view/"]');
                log(`[Styler] 현재 DOM에서 발견된 글 링크 수: ${links.length}개`);
                
                links.forEach(link => {
                    try 
                    {
                        const href = link.getAttribute('href');
                        const url = new URL(href, location.origin);
                        const galleryId = url.searchParams.get('id');
                        const postNo = url.searchParams.get('no');

                        if (galleryId && postNo) 
                        {
                            const key = `${galleryId}_${postNo}`;

                            if (visitedMap[key]) 
                            {
                                // 변경 후
                                // log(`[MatchSuccess] 🎉 방문 기록 일치함! -> key: [${key}] | 텍스트: "${link.innerText.trim()}"`);

                                link.classList.add('jk-custom-visited');
                                link.querySelectorAll('*').forEach(child => child.classList.add('jk-custom-visited'));
                                matchCount++;
                            }
                        }
                    } 
                    catch (e) 
                    {
                        log(`[LinkScan] ⚠️ URL 파싱 에러 발생: ${e.message}`);
                    }
                });
            });

            log(`[Styler] ✨ 이번 렌더링 결과 -> 스타일 적용된 방문 글: ${matchCount}개`);            

        }

        function processDocument() {
            const targetContainer = document.querySelector('.gall_list') || document.body;
            applyVisitedStyles(targetContainer);
        }

        // 초기 로드 시 실행
        if (document.readyState === 'loading') {
            window.addEventListener('DOMContentLoaded', processDocument);
        } else {
            processDocument();
        }
        setTimeout(processDocument, 100);

        // 직전 URL을 기억할 변수 선언
        let lastUrl = location.href;
        let debounceTimer = null;

        const observer = new MutationObserver((mutations) => 
        {
            // log("옵저버 작동")
            let hasRelevantChange = false;
            let isUrlChanged = false;

            // 1. DOM에 변화가 생겼을 때 주소창 URL이 실제로 변경되었는지 확인
            if (location.href !== lastUrl)
            {
                lastUrl = location.href;
                isUrlChanged = true;
            }

            // 감지된 변화(mutations)들을 순회하며 실제 글 목록 관련 변화인지 확인
            for (const mutation of mutations) 
            {
                // 1. 새로운 요소가 추가된 경우
                if (mutation.addedNodes.length > 0) 
                {
                    for (const node of mutation.addedNodes) 
                    {
                        if (node.nodeType === Node.ELEMENT_NODE) 
                        {
                            // 추가된 노드가 글 목록('.gall_list')이거나 그 내부의 글 링크를 포함하는 경우
                            if (node.classList.contains('gall_list') || 
                                node.querySelector('.gall_list') || 
                                node.querySelector('a[href*="/board/view/"]')) 
                            {
                                hasRelevantChange = true;
                                break;
                            }
                        }
                    }
                }
                if (hasRelevantChange) break;
            }

            // 2. URL이 변경된 경우 기존 타이머 내부에 있던 라우팅 분기 처리 수행
            if (isUrlChanged)
            {
                log(`[Tracker] 🔍 주소창 변경 감지됨: ${location.href}`);
                
                const currentUrl = new URL(location.href);
                const galleryId = currentUrl.searchParams.get('id');
                const postNo = currentUrl.searchParams.get('no');

                // 변경된 URL이 게시글 조회(view) 페이지 형태라면 수집기 작동
                if (galleryId && postNo)
                {
                    log(`[Tracker] 🎉 미리보기 등으로 인한 글 조회 감지 -> 수집 실행 (${galleryId}_${postNo})`);
                    initPostTracker();
                }
                else
                {
                    initListViewStyler();
                }
            }

            // 3. 글 목록 관련 변화일 때만 디바운스를 거쳐 스타일 재적용
            if (hasRelevantChange)
            {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => 
                {
                    log('[Styler] 👁️ 글 목록 갱신(리프레셔 등) 감지됨 -> 스타일 재적용');

                    processDocument();
                }, 300);
            }
        });

        // body를 감시하되, attributes는 제외하고 자식 노드 추가/삭제(childList)만 엄격하게 감시
        observer.observe(document.body, 
        {
            childList: true,
            subtree: true,
            attributes: false // 속성 변화 감지 제외 (광고/스크립트 노이즈 방지)
        });

        log('[Styler] 👁️ 최적화된 DOM 감시 시작 (글 목록 변경 시에만 반응)');
    }


// ==========================================
// MARK:실행 영역
// ==========================================
function main() 
{
    log('=== 스크립트 실행 시작 ===');
    
    // 1. 최초 로드 시 실행
    initPostTracker();
    initListViewStyler();
}

// 스크립트 실행
main();

})();