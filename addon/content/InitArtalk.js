/* global Services, document, console, Artalk */

function initArtalk(window, document) {
    const addonInfo = window.arguments[0].addonInfo;
    const downloadSourceAction = window.arguments[0].downloadSourceAction;
    const openInViewAction = window.arguments[0].openInViewAction;
    const site = window.arguments[0].site;
    const zotero = window.arguments[0].zotero;
    const prefersDarkScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const getString = window.arguments[0].getString;
    const needLogin = window.arguments[0].needLogin;

    let hasLogin = false;
    try {
      const artalkUser = Services.prefs.getStringPref('ArtalkUser', '{}');
      const user = JSON.parse(artalkUser);
      if (!user.email || !user.name) {
        const name = zotero.Users.getCurrentUsername() || zotero.Prefs.get('sync.server.username') || "";
        const email = Services.prefs.getStringPref('extensions.zotero.sync.server.username', '') || "";
        // const email = Services.prefs.getStringPref('extensions.zotero.sync.server.username', '') || `${zotero.Users.getCurrentUserID()}@zotero.org` || "";
        if (!user.email) {
          user.email = email;
        }
        if (!user.name) {
          user.name = name;
        }
        Services.prefs.setStringPref('ArtalkUser', JSON.stringify(user));
      }
      hasLogin = !!user.email
      if (hasLogin) hasLogin = !!user.name
    } catch (e) {
      console.error(e);
    }

    const artalk = Artalk.init({
      el: '#artalk-placeholder',
      pageKey: `/${addonInfo.repo}/post`,
      pageTitle: addonInfo.name,
      server: 'https://artalk.zotero.store',
      site: site,
      darkMode: prefersDarkScheme.matches,
      getItem: (key) => Services.prefs.getStringPref(`${key}`, ''),
      setItem: (key, value) => Services.prefs.setStringPref(`${key}`, value),
      downloadSource: (url) => downloadSourceAction(url),
      openInView: (url) => openInViewAction(url),
      beforeSubmit: (editor, next) => {
        if (!artalk.getConf().pluginURLs || hasLogin || !needLogin) {
          next();
          return;
        }
        const artalkUser = Services.prefs.getStringPref('ArtalkUser', '{}');
        const user = JSON.parse(artalkUser);
        if (!user.email || !user.name) {
          const addonInfoString = encodeURIComponent(JSON.stringify(addonInfo));
          const url = `https://plugin.zotero.store?callbackZoteroUserConfig=1&amp;addonInfo=` + addonInfoString;
          const pluginAuthWindow = openInViewAction(url);
          zotero.Promise.delay(1000).then(() => {
            pluginAuthWindow.onunload = () => {
              window.arguments[0].reload();
            }
          });
          return;
        }
        next();
      }
    });
    artalk.on('mounted', () => { // not working in init, so we need to call it again  
      artalk?.update({
        locale: Services.prefs.getStringPref(`intl.accept_languages`, '[en-US]').split(',')[0],
        // sendBtn: (needLogin ? 1 : 0) + (!!artalk.getConf().pluginURLs ? 1 : 0) + (!hasLogin ? 1 : 0) === 3 ? getString('send-button-status-login') : '',
      })

      document.addEventListener('click', function (e) {
        const anchor = e.target.closest('a[target="_blank"]')
        if (!anchor) { return }
        if (!anchor.hasAttribute('href')) { return }
        const href = anchor.getAttribute('href')
        if (href.startsWith('javascript:')) { return }
        if (href === window.location.href) { return }
        if (!href.trim()) { return }
        e.preventDefault();
        e.stopImmediatePropagation();
        openInViewAction(anchor.href);
      }, true);
      document.addEventListener('click', function (e) {
        const placeholderAttrName = 'name';
        const anchor = e.target.closest(`a[${placeholderAttrName}^="zotero://"]`);
        if (!anchor) { return }
        const scheme = anchor.getAttribute(placeholderAttrName)
        e.preventDefault();
        e.stopImmediatePropagation();

        const link = document.createElement('a');
        link.href = scheme;
        link.target = '_self';
        link.click();
      }, true);
    })
    window.addEventListener('unload', () => {
      artalk.destroy();
    });

    const updateTheme = (e) => {
      const newTheme = e.matches ? 'dark' : 'light'
      artalk.setDarkMode(newTheme === 'dark')
    }
    prefersDarkScheme.addEventListener('change', updateTheme)

  return artalk;
} 