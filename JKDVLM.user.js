// ==UserScript==
// @name         DCInside Visited Link Manager
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  디시 url 방문 기록을 수집하여 페이지에 반영
// @author       JKAKK
// @match        https://gall.dcinside.com/*
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
    function log(msg) {
        if (CONFIG.isDebug) {
            console.log(`[JKDVLM] ${msg}`);
        }
    }

    /**
     * 스토리지를 불러오고, 90일이 지난 오래된 방문 기록을 자동 청소(Purge)합니다.
     */
    function loadAndCleanStorage() {
        let visitedMap = GM_getValue(CONFIG.STORAGE_KEY, {});
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

        let debounceTimer = null;
const observer = new MutationObserver((mutations) => {
    let hasRelevantChange = false;

    // 감지된 변화(mutations)들을 순회하며 실제 글 목록 관련 변화인지 확인
    for (const mutation of mutations) {
        // 1. 새로운 요소가 추가된 경우
        if (mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // 추가된 노드가 글 목록('.gall_list')이거나 그 내부의 글 링크를 포함하는 경우
                    if (node.classList.contains('gall_list') || 
                        node.querySelector('.gall_list') || 
                        node.querySelector('a[href*="/board/view/"]')) {
                        hasRelevantChange = true;
                        break;
                    }
                }
            }
        }
        if (hasRelevantChange) break;
    }

    // 글 목록 관련 변화일 때만 디바운스를 거쳐 실행
    if (hasRelevantChange) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            log('[Styler] 👁️ 글 목록 갱신(리프레셔 등) 감지됨 -> 스타일 재적용');
            processDocument();
        }, 300);
    }
});

// body를 감시하되, attributes는 제외하고 자식 노드 추가/삭제(childList)만 엄격하게 감시
observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false // 속성 변화 감지 제외 (광고/스크립트 노이즈 방지)
});

log('[Styler] 👁️ 최적화된 DOM 감시 시작 (글 목록 변경 시에만 반응)');
    }


    // ==========================================
// [Execution Entry Point]
// ==========================================
function main() 
{
    log('=== 스크립트 실행 시작 ===');
    
    // 1. 최초 로드 시 실행
    initPostTracker();
    initListViewStyler();

    // 이전 URL을 기억해 둘 변수
let lastUrl = location.href;

// FIXME 폴링 방식에서 이벤트 기반으로 변경 필요 | 클릭 기반
// 0.2초마다 주소창 변화를 강제로 체크하는 확실한 방법
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href; // 현재 URL 갱신
        
        log(`[Tracker] 🔍 주소창 변경 감지됨: ${location.href}`);
        
        const currentUrl = new URL(location.href);
        const galleryId = currentUrl.searchParams.get('id');
        const postNo = currentUrl.searchParams.get('no');

        // 변경된 URL이 게시글 조회(view) 페이지 형태라면 수집기 작동
        if (galleryId && postNo) {
            log(`[Tracker] 🎉 미리보기 등으로 인한 글 조회 감지 -> 수집 실행 (${galleryId}_${postNo})`);
            initPostTracker();
        }
        else
            initListViewStyler()
    }
}, CONFIG.urlCheckInterval);
}

// 스크립트 실행
main();

})();