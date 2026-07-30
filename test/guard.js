// Страж, который внедряется ДО юзерскрипта и ловит именно те классы ошибок,
// которые мы уже поймали на живом сайте руками пользователя.
//
// 1. Удаление чужих узлов. Всё, что не создано скриптом (у наших элементов
//    id или class начинается с tm-), считается узлом сайта. Его удаление —
//    ошибка: на React это ломает согласование дерева и даёт белый экран.
// 2. Имитация React. Удалённый чужой узел возвращается на место через тик.
//    Скрипт, который удаляет вместо того чтобы прятать, сорвётся в цикл.
// 3. Счётчик мутаций. Буря мутаций после того как страница успокоилась —
//    это и есть «моргает при прокрутке».
// 4. Необработанные исключения и ошибки в консоли.
(() => {
    const isOurs = (n) => {
        if (!n || n.nodeType !== 1) return false;
        const id = n.id || '';
        const cls = (n.className && n.className.toString) ? n.className.toString() : '';
        return id.startsWith('tm-') || /\btm-/.test(cls);
    };

    const report = {
        siteNodeRemovals: [],
        mutationsAfterSettle: 0,
        errors: [],
        reinserted: 0,
    };
    window.__tmGuard = report;

    const origRemoveChild = Node.prototype.removeChild;
    Node.prototype.removeChild = function (child) {
        if (!isOurs(child) && child && child.nodeType === 1) {
            report.siteNodeRemovals.push(describe(child));
            const parent = this, next = child.nextSibling;
            const res = origRemoveChild.call(this, child);
            setTimeout(() => { try { parent.insertBefore(child, next); report.reinserted++; } catch (e) {} }, 0);
            return res;
        }
        return origRemoveChild.call(this, child);
    };

    const origRemove = Element.prototype.remove;
    Element.prototype.remove = function () {
        if (!isOurs(this) && this.parentNode) {
            report.siteNodeRemovals.push(describe(this));
            const parent = this.parentNode, next = this.nextSibling, self = this;
            origRemove.call(this);
            setTimeout(() => { try { parent.insertBefore(self, next); report.reinserted++; } catch (e) {} }, 0);
            return;
        }
        return origRemove.call(this);
    };

    function describe(el) {
        const cls = (el.className && el.className.toString) ? el.className.toString() : '';
        return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls.trim().split(/\s+/).slice(0, 2).join('.') : '');
    }

    window.addEventListener('error', (e) => report.errors.push(String(e.message)));
    window.addEventListener('unhandledrejection', (e) => report.errors.push('unhandled: ' + String(e.reason)));

    // Счётчик включается по команде из теста, когда страница уже устоялась.
    window.__tmStartMutationCount = () => {
        report.mutationsAfterSettle = 0;
        const mo = new MutationObserver((list) => { report.mutationsAfterSettle += list.length; });
        mo.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
        return true;
    };
})();
