// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startSearch') {
    if (request.searchMode === 'scroll') {
      startScrollSearch(request.keyword, request.maxScrollTop);
    } else {
      startPageSearch(request.keyword, request.maxPages);
    }
  }
});

// ページ読み込み時に検索状態を確認
window.addEventListener('load', async () => {
  const data = await chrome.storage.local.get(['searchActive', 'searchMode', 'keyword', 'maxPages', 'currentPage', 'maxScrollTop']);

  if (data.searchActive && data.keyword) {
    if (data.searchMode === 'scroll') {
      // スクロールモードはページ遷移しないので、loadイベントでの再開は不要
    } else {
      // ページ遷移モード: 検索が進行中の場合、現在のページをチェック
      checkCurrentPage(data.keyword, data.maxPages, data.currentPage || 0);
    }
  }
});

// ===== ページ遷移モード =====

async function startPageSearch(keyword, maxPages) {
  await chrome.storage.local.set({
    searchActive: true,
    searchMode: 'page',
    currentPage: 0
  });

  // 最初のページをチェック
  checkCurrentPage(keyword, maxPages, 0);
}

async function checkCurrentPage(keyword, maxPages, pageCount) {
  // 検索が停止されているか確認
  const data = await chrome.storage.local.get(['searchActive']);
  if (!data.searchActive) {
    return;
  }

  // ページ内容をチェック
  const pageText = document.body.innerText;
  const found = pageText.includes(keyword);

  if (found) {
    // キーワードが見つかった
    await chrome.storage.local.set({
      searchActive: false,
      searchStatus: `キーワード "${keyword}" を発見しました！(${pageCount + 1}ページ目)`
    });

    // ページ内のキーワードをハイライト
    highlightKeyword(keyword);

    alert(`キーワード "${keyword}" を発見しました！\n現在のページ: ${pageCount + 1}ページ目`);
    return;
  }

  // 最大ページ数に達したかチェック
  if (pageCount >= maxPages - 1) {
    await chrome.storage.local.set({
      searchActive: false,
      searchStatus: `キーワードは見つかりませんでした (${maxPages}ページまで検索)`
    });

    alert(`キーワード "${keyword}" は見つかりませんでした。\n${maxPages}ページまで検索しました。`);
    return;
  }

  // 次のページへ
  const nextUrl = getNextPageUrl();
  if (nextUrl) {
    await chrome.storage.local.set({
      currentPage: pageCount + 1,
      searchStatus: `検索中... (${pageCount + 1}/${maxPages} ページ)`
    });

    // 次のページに遷移
    window.location.href = nextUrl;
  } else {
    // page=パラメータが見つからない
    await chrome.storage.local.set({
      searchActive: false,
      searchStatus: 'URLにpage=パラメータが見つかりません'
    });

    alert('URLにpage=パラメータが見つかりません');
  }
}

function getNextPageUrl() {
  const currentUrl = new URL(window.location.href);
  const params = currentUrl.searchParams;

  // page=パラメータを探す
  if (params.has('page')) {
    const currentPage = parseInt(params.get('page')) || 0;
    params.set('page', currentPage + 1);
    return currentUrl.toString();
  }

  // pageパラメータがない場合は追加
  // 現在が1ページ目と仮定して2ページ目へ
  params.set('page', 2);
  return currentUrl.toString();
}

// ===== スクロールモード =====

// スクロール前に見つかったテキストを記録（新しくロードされたコンテンツのみ検索するため）
let previousTextLength = 0;

async function startScrollSearch(keyword, maxScrollTop) {
  // 現在のスクロール位置を取得
  const initialScrollTop = window.scrollY || document.documentElement.scrollTop || 0;

  await chrome.storage.local.set({
    searchActive: true,
    searchMode: 'scroll',
    currentScrollTop: initialScrollTop
  });

  // 現在のテキスト長を記録
  previousTextLength = document.body.innerText.length;

  // まず現在の位置でチェック
  const pageText = document.body.innerText;
  if (pageText.includes(keyword)) {
    await chrome.storage.local.set({
      searchActive: false,
      searchStatus: `キーワード "${keyword}" を発見しました！(スクロール位置: ${initialScrollTop}px)`
    });
    highlightKeyword(keyword);
    alert(`キーワード "${keyword}" を発見しました！\nスクロール位置: ${initialScrollTop}px`);
    return;
  }

  // スクロール検索を開始（現在の位置から）
  scrollAndSearch(keyword, maxScrollTop, initialScrollTop);
}

function scrollAndSearch(keyword, maxScrollTop, currentScrollTop) {
  // 検索が停止されているか確認
  chrome.storage.local.get(['searchActive']).then(data => {
    if (!data.searchActive) {
      return;
    }

    // 最大スクロール位置に達したかチェック
    if (currentScrollTop >= maxScrollTop) {
      chrome.storage.local.set({
        searchActive: false,
        searchStatus: `キーワードは見つかりませんでした (${maxScrollTop}pxまでスクロール)`
      });
      alert(`キーワード "${keyword}" は見つかりませんでした。\n${maxScrollTop}pxまでスクロールしました。`);
      return;
    }

    // ページの実際の最大スクロール位置を取得
    const maxDocumentScrollTop = document.documentElement.scrollHeight - window.innerHeight;

    // これ以上スクロールできない場合
    if (currentScrollTop > 0 && currentScrollTop >= maxDocumentScrollTop) {
      chrome.storage.local.set({
        searchActive: false,
        searchStatus: `キーワードは見つかりませんでした (ページ末端に到達: ${currentScrollTop}px)`
      });
      alert(`キーワード "${keyword}" は見つかりませんでした。\nページ末端に到達しました (${currentScrollTop}px)`);
      return;
    }

    // 次のスクロール位置を計算（1000pxずつスクロール）
    const scrollStep = 1000;
    const nextScrollTop = Math.min(currentScrollTop + scrollStep, maxScrollTop);

    // スクロール実行
    window.scrollTo(0, nextScrollTop);

    // ステータスを更新
    chrome.storage.local.set({
      currentScrollTop: nextScrollTop,
      searchStatus: `スクロール検索中... (${nextScrollTop}/${maxScrollTop} px)`
    });

    // スクロール後にコンテンツをチェック
    setTimeout(() => {
      // 検索が停止されているか再確認
      chrome.storage.local.get(['searchActive']).then(checkData => {
        if (!checkData.searchActive) {
          return;
        }

        // 現在のテキストでキーワードを検索
        const pageText = document.body.innerText;
        if (pageText.includes(keyword)) {
          chrome.storage.local.set({
            searchActive: false,
            searchStatus: `キーワード "${keyword}" を発見しました！(スクロール位置: ${nextScrollTop}px)`
          });
          highlightKeyword(keyword);
          alert(`キーワード "${keyword}" を発見しました！\nスクロール位置: ${nextScrollTop}px`);
          return;
        }

        // 次のスクロールへ
        scrollAndSearch(keyword, maxScrollTop, nextScrollTop);
      });
    }, 500);
  });
}

// ===== 共通機能 =====

function highlightKeyword(keyword) {
  // シンプルなハイライト機能
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    null,
    false
  );

  const nodesToReplace = [];
  let node;

  while (node = walker.nextNode()) {
    if (node.nodeValue.includes(keyword)) {
      nodesToReplace.push(node);
    }
  }

  nodesToReplace.forEach(node => {
    const span = document.createElement('span');
    span.innerHTML = node.nodeValue.replace(
      new RegExp(escapeRegExp(keyword), 'g'),
      '<mark style="background-color: yellow; font-weight: bold;">$&</mark>'
    );
    node.parentNode.replaceChild(span, node);
  });
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
