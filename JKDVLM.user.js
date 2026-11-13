// ==UserScript==
// @name         DCInside Visited Link Manager
// @namespace    http://tampermonkey.net/
// @version      0.5
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

    class JKDVLM
    {
        // MARK: 변수 영역
        CONFIG = {
            // 디버깅 로그 활성화 여부
            isDebug: false
            ,STORAGE_KEY: 'dc_visited_posts_store'
            ,EXPIRY_DAYS: 90
            ,
            /**
             * #### 방문 글 저장 만료 기간
             * @type {number} 
             */
            EXPIRY_TIME: 90 * 24 * 60 * 60 * 1000
            ,visitedColor: '#795091'
            // 디바운드 시간 ms
            ,debounceDelay: 300
        };

        /**
         * #### 글 목록 변경 감지 옵저버
         * @type {MutationObserver} 
         */
        observer = null;
        
        // MARK: 함수 영역
        constructor()
        {
            this.init();
        }

        /**
         * #### 스크립트 시작점
         * @returns {void} - 
         */
        init()
        {
            this.log("스크립트 작동")

            this.initPostTracker();
            this.initListViewStyler();
        }

        /**
         * #### 전용 디버그 로거
         * @description [JKDVLM] [타임스탬프] [호출함수명] \n 메시지 구성
         * @param {string} msg - 메시지
         * @returns {void} - 
         */
        log(msg) 
        {
            if(this.CONFIG.isDebug === false)
                return

            const now = new Date();
            // "HH:MM:SS" 형식 추출
            const timeStr = now.toTimeString().split(' ')[0]; 

             // log()를 직접 호출한 함수명 추출
            const caller = new Error().stack
                ?.split('\n')[2]
                ?.trim()
                ?.match(/at (.+?) \(/)?.[1] ?? "unknown";

            console.log(`[JKDVLM] [${timeStr}] [${caller}]\n${msg}`);
        }

        /**
         * #### 저장된 방문기록 불러오기 및 오래된 기록 제거
         * @description Map 처럼 키, 값 pair 를 가진 자료구조 객체 반환
         * @returns {Object<string, number>} - 방문기록
         */
        loadAndCleanStorage() 
        {
            const storageKey = this.CONFIG.STORAGE_KEY
            const expiryTime = this.CONFIG.EXPIRY_TIME

            // @@readme에 언급된 캐시 문제 테스트용 그냥 getvalue 안하고 새 객체 할당 받기
            let rawData = GM_getValue(storageKey, {});
            this.log(`${Object.keys(rawData).length}개`)

            /** @type {Object<string, number>} */
            let visitedData = JSON.parse(JSON.stringify(rawData));
            const now = Date.now();
            let isModified = false;
            let cleanedCount = 0;

            for (const key in visitedData) 
            {
                if (now - visitedData[key] > expiryTime) 
                {
                    delete visitedData[key];
                    isModified = true;
                    cleanedCount++;
                }
            }
            
            // 오래된 방문 기록 있으면 제거 확정
            if (isModified) 
            {
                GM_setValue(this.CONFIG.STORAGE_KEY, visitedData);
                this.log(`[Storage] 만료된 기록 ${cleanedCount}개 자동 청소 완료`);
            }

            return visitedData;
        }

        /**
         * #### 방문 기록 단일 글 저장
         * @param {string} galleryId - 갤러리url이름
         * @param {string} postNo - 글번호
         * @returns {void}
         */
        saveVisitedPost(galleryId, postNo) 
        {
            if (!galleryId || !postNo) 
                return;
    
            const key = `${galleryId}_${postNo}`;
            let visitedData = this.loadAndCleanStorage();
    
            if (!visitedData[key]) 
            {
                visitedData[key] = Date.now();
                GM_setValue(this.CONFIG.STORAGE_KEY, visitedData);
                this.log(`[Tracker] 새 글 방문 기록 저장 성공 -> 갤러리: ${galleryId}, 글번호: ${postNo}`);
            } 
            else 
                this.log(`[Tracker] 이미 기록되어 있는 글 -> 갤러리: ${galleryId}, 글번호: ${postNo}`);
        }

        // MARK: 방문 기록 수집
        /**
         * #### 방문 기록 수집
         * @description url 검사해서 개별 글일 경우 수집 | 이 함수를 수집 시점에서 사용
         * @returns {void} - 
         */
        initPostTracker() 
        {
            if (!location.pathname.includes('/board/view/'))
                return;
    
            this.log('[Tracker] 개별 글 보기 페이지 진입 감지');
    
            const urlParams = new URLSearchParams(location.search);
            const galleryId = urlParams.get('id');
            const postNo = urlParams.get('no');
    
            this.log(`[Tracker] 파싱된 정보 - id: ${galleryId}, no: ${postNo}`);

            this.saveVisitedPost(galleryId, postNo);
        }

        // MARK: 방문 기록 적용

        /**
         * #### 페이지에 방문글용 CSS 를 head 에 주입
         * @description 해당 id를 적용할 곳에 추가
         * @returns {void} - 
         */
        injectCustomCSS() 
        {
            if (document.getElementById('jk-visited-style'))   
                return;
        
            const style = document.createElement('style');
            style.id = 'jk-visited-style';
            style.innerHTML = `
                a.jk-custom-visited, 
                a.jk-custom-visited *, 
                a.jk-custom-visited:visited, 
                a.jk-custom-visited:visited *, 
                a.jk-custom-visited:link,
                a.jk-custom-visited:link * {
                    color: ${this.CONFIG.visitedColor} !important;
                }
            `;

            document.head.appendChild(style);

            this.log('[CSS] 커스텀 방문 링크 스타일 주입 완료');
        }

        /**
         * #### 방문 기록 스타일 적용 시작
         * @returns {void} - 
         */
        initListViewStyler() 
        {
            this.log('[Styler] 목록 페이지 스타일러 초기화 시작');
            
            this.injectCustomCSS();
    
            const callback = this.applyDocument.bind(this);
            
            // @@ 초기 로드 시 실행
            if (document.readyState !== 'complete')
            {
                window.addEventListener('load', callback, { once: true });
            }
                
            this.initListViewObserver();
        }

        /**
         * #### 컨테이너 내의 게시물 링크들을 순회하며 방문 기록 대조 후 CSS 적용
         * @param {HTMLElement} rootElement - 설명
         * @returns {void} - 
         */
        applyVisitedStyles(rootElement, visitedMap) 
        {
            const containers = rootElement.querySelectorAll ? [rootElement] : rootElement;
            let matchCount = 0;

            containers.forEach(container => {
                /** @type {NodeListOf<HTMLAnchorElement>} */
                const links = container.querySelectorAll('a[href*="/board/view/"]');
                this.log(`[Styler] 현재 DOM에서 발견된 글 링크 수: ${links.length}개`);
                
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
                                // this.log(`[MatchSuccess] 🎉 방문 기록 일치함! -> key: [${key}] | 텍스트: "${link.innerText.trim()}"`);

                                link.classList.add('jk-custom-visited');
                                link.querySelectorAll('*').forEach(child => child.classList.add('jk-custom-visited'));
                                matchCount++;
                            }
                        }
                    } 
                    catch (e) 
                    {
                        this.log(`[LinkScan] ⚠️ URL 파싱 에러 발생: ${e.message}`);
                    }
                });
            });

            // @@ 여기 로그에서 댓글 색칠 되는것도 방문 글로 찍혀서 +2 되는거니 추적 바람

            this.log(`[Styler] ✨ 이번 렌더링 결과 -> 스타일 적용된 방문 글: ${matchCount}개`);            

        }

        /**
         * #### 본문부분을 body 에서 가져와서 방문글 스타일 적용
         * @description 방문 기록을 적용하는 최말단
         * @returns {void} - 
         */
        applyDocument() 
        {
            // @@ 방문 기록 로드 | 구조 개선 검토
            const visitedData = this.loadAndCleanStorage();
            const targetContainer = document.querySelector('.gall_list') || document.body;

            this.applyVisitedStyles(targetContainer, visitedData);
        }

        initListViewObserver()
        {
            // 직전 URL을 기억할 변수 선언
            let lastUrl = location.href;
            let debounceTimer = null;
    
            this.observer = new MutationObserver((mutations) => {
                // this.log("옵저버 작동")
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
                                if (node.classList.contains('gall_list') 
                                || node.querySelector('.gall_list') 
                                || node.querySelector('a[href*="/board/view/"]')) 
                                {
                                    hasRelevantChange = true;
                                    break;
                                }
                            }
                        }
                    }

                    if (hasRelevantChange) 
                        break;
                }
    
                // 2. URL이 변경된 경우 기존 타이머 내부에 있던 라우팅 분기 처리 수행
                if (isUrlChanged)
                {
                    this.log(`[Tracker] 🔍 주소창 변경 감지됨: ${location.href}`);
                    
                    const currentUrl = new URL(location.href);
                    const galleryId = currentUrl.searchParams.get('id');
                    const postNo = currentUrl.searchParams.get('no');
    
                    // 변경된 URL이 게시글 조회(view) 페이지 형태라면 수집기 작동
                    if (galleryId && postNo)
                    {
                        this.log(`[Tracker] 🎉 미리보기 등으로 인한 글 조회 감지 -> 수집 실행 (${galleryId}_${postNo})`);
                        this.initPostTracker();
                    }
                    // 페이지로 되돌아 왔다면 스타일 재적용
                    else
                    {
                        this.applyDocument();
                    }
                }
    
                // 3. 글 목록 관련 변화일 때만 디바운스를 거쳐 스타일 재적용
                if (hasRelevantChange)
                {
                    if (debounceTimer)
                        clearTimeout(debounceTimer);

                    debounceTimer = setTimeout(() => {
                        this.log('[Styler] 👁️ 글 목록 갱신(리프레셔 등) 감지됨 -> 스타일 재적용');
    
                        this.applyDocument();
                    }, this.CONFIG.debounceDelay);
                }
            });
    
            // body를 감시하되, attributes는 제외하고 자식 노드 추가/삭제(childList)만 엄격하게 감시
            this.observer.observe(document.body, 
            {
                childList: true,
                subtree: true,
                // 속성 변화 감지 제외 (광고/스크립트 노이즈 방지)
                attributes: false 
            });
    
            this.log('[Styler] 👁️ 최적화된 DOM 감시 시작 (글 목록 변경 시에만 반응)');

        }
    }


// MARK:실행 영역
new JKDVLM();

})();