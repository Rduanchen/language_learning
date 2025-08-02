
hexo.extend.tag.register('mvp', function (args, content) {
    const title = args[0] || 'unknown';
    return `<h1 class="mvp_title">${title}</h1>`;
}, { ends: false });