// メッセージリスナー
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startSearch') {
    startPageSearch(request.keyword, request.maxPages);
  }
});

// ページ読み込み時に検索状態を確認
window.addEventListener('load', async () => {
  const data = await chrome.storage.local.get(['searchActive', 'keyword', 'maxPages', 'currentPage']);
  
  if (data.searchActive && data.keyword) {
    // 検索が進行中の場合、現在のページをチェック
    checkCurrentPage(data.keyword, data.maxPages, data.currentPage || 0);
  }
});

async function startPageSearch(keyword, maxPages) {
  await chrome.storage.local.set({
    searchActive: true,
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
