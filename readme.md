## 다른 context 에서 접근한 링크는 여전히 페이지에 방문 처리되지 않는 현상
이는 크롬 브라우저 보안 정책인 방문 링크 파티셔닝 때문.
https://blog.mozilla.org/security/2010/03/31/plugging-the-css-history-leak/

https://developer.chrome.com/blog/visited-links?hl=ko#:~:text=If%20you%20haven

해당 정책을 존중하여 접근한 url 수집과 방문 기록 적용을 덧붙이는 기능을 가진 템퍼몽키 스크립트.
즉, 기존 방문 기록 정책을 덮어쓰기함.

---
디시 리프레셔의 페이지 전환 없이 글 목록 새로고침에 대응하는 옵저버 추가.
미리보기로 글 조회하는 것도 수집하도록 이벤트 리스터 추가