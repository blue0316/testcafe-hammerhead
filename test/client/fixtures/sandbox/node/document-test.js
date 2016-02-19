var processScript    = hammerhead.get('../processing/script').processScript;

var browserUtils  = hammerhead.utils.browser;
var nativeMethods = hammerhead.nativeMethods;
var iframeSandbox = hammerhead.sandbox.iframe;
var Promise       = hammerhead.Promise;

QUnit.testStart(function () {
    // NOTE: The 'window.open' method used in QUnit.
    window.open       = nativeMethods.windowOpen;
    window.setTimeout = nativeMethods.setTimeout;
    iframeSandbox.on(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, iframeSandbox.iframeReadyToInitHandler);
});

QUnit.testDone(function () {
    iframeSandbox.off(iframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
});

test('document.write for iframe.src with javascript protocol', function () {
    var $div = $('<div>').appendTo('body');

    overrideDomMeth($div[0]);

    var $iframe = $('<iframe id="test4" src="javascript:&quot;<html><body><a id=\'link\' href=\'http://google.com/\'></body></html>&quot;"></iframe>"');

    $div[0].appendChild($iframe[0]);
    ok($iframe[0].contentDocument.write.toString() !== nativeMethods.documentWrite.toString());

    $iframe.remove();
});

asyncTest('document.write for iframe with empty url', function () {
    var $div   = $('<div>').appendTo('body');
    var cheked = false;

    overrideDomMeth($div[0]);

    var $iframe = $('<iframe id="test3" src="about:blank">"');

    var check = function () {
        var document = $iframe[0].contentDocument;

        if (document)
            ok(document.write.toString() !== nativeMethods.documentWrite.toString());
    };

    check();

    $iframe.ready(check);
    $iframe.load(function () {
        check();

        var id = setInterval(function () {
            if (cheked) {
                clearInterval(id);
                $iframe.remove();
                start();
            }
        }, 10);

    });

    $div[0].appendChild($iframe[0]);
    check();
    cheked    = true;
});

if (!browserUtils.isFirefox) {
    test('override document after document.write calling', function () {
        var $div    = $('<div>').appendTo('body');
        var $sdiv   = $('<div>').appendTo('body');
        var $iframe = $('<iframe id="test11" src="about:blank">"');
        var iframe  = $iframe[0];

        var checkIframeDocumentOverrided = function () {
            var document = iframe.contentDocument;
            var result   = true;

            if (document) {
                if (document.write.toString() === nativeMethods.documentWrite.toString())
                    result = false;
            }

            // NOTE: Stack overflow check.
            ok(!document || document.getElementsByTagName('body'));
            ok(window.top.document.getElementsByTagName('body'));

            ok(result);
        };

        var checkWriteFunction = function () {
            checkIframeDocumentOverrided();
            iframe.contentDocument.open();
            checkIframeDocumentOverrided();
            iframe.contentDocument.write('<div></div>');
            checkIframeDocumentOverrided();
            iframe.contentDocument.close();
            checkIframeDocumentOverrided();

            iframe.contentDocument.open();
            checkIframeDocumentOverrided();
            iframe.contentDocument.write('<html><body><a href="http://google.com/"></body></html>');
            checkIframeDocumentOverrided();
            iframe.contentDocument.close();
            checkIframeDocumentOverrided();
        };

        $iframe.ready(checkIframeDocumentOverrided);
        $iframe.load(checkIframeDocumentOverrided);

        // NOTE: After appended to DOM.
        $div[0].appendChild(iframe);
        checkWriteFunction();

        // NOTE: After reinserted to DOM.
        $sdiv[0].appendChild(iframe);
        checkWriteFunction();

        $iframe.remove();
        $sdiv.remove();
        $div.remove();
    });
}

module('querySelector, querySelectorAll (GH-340)');

test('quote types in attribute selectors', function () {
    var link = document.createElement('a');

    link.setAttribute('href', 'http://some.domain.com');
    document.body.appendChild(link);

    ok(document.querySelector('[href="http://some.domain.com"]'));
    ok(document.querySelector("[href='http://some.domain.com']"));

    link.parentNode.removeChild(link);
});

test('non-processed attributes', function () {
    var link = document.createElement('a');

    link.setAttribute('data-info', 'external link');
    link.setAttribute('hreflang', 'ru-RU');
    document.body.appendChild(link);

    ok(document.querySelector('[data-info~=external]'));
    ok(document.querySelector('[hreflang|=ru]'));

    link.parentNode.removeChild(link);
});

//http://www.w3.org/TR/css3-selectors/#attribute-selectors
test('attrubute types', function () {
    var link = document.createElement('a');
    var div  = document.createElement('div');

    link.setAttribute('href', 'http://some.domain.com');
    div.className = 'container';
    div.appendChild(link);

    document.body.appendChild(div);

    // [attribute]
    ok(div.querySelector('[href]'));

    // [attribute=value]
    ok(document.querySelector('[href="http://some.domain.com"]'));

    // [attribute~=value] - whitespace-separated values
    // Proxied attributes don't contain whitespace-separated values

    // [attribute|=value] - equal or starts with for value that ends with '-'
    // This is primarily intended to allow language subcode matches

    // [attribute^=value] - starts with
    ok(document.querySelector('[href^="http://some"]'));

    // [attribute$=value] - ends with
    ok(document.querySelector('[href$="domain.com"]'));

    // [attribute*=value] - contains value
    ok(document.querySelector('[href*=domain]'));
    link.parentNode.removeChild(link);
});

test('document, documentFragment, element', function () {
    var link         = document.createElement('a');
    var div          = document.createElement('div');
    var fragment     = document.createDocumentFragment();
    var fragmentLink = document.createElement('a');

    link.setAttribute('href', 'http://some.domain.com');
    fragmentLink.setAttribute('href', 'http://some.domain.com');
    div.appendChild(link);
    document.body.appendChild(div);
    fragment.appendChild(fragmentLink);

    ok(document.querySelector('a[href="http://some.domain.com"]'));
    strictEqual(document.querySelectorAll('a[href="http://some.domain.com"]').length, 1);
    ok(div.querySelector('[href="http://some.domain.com"]'));
    strictEqual(div.querySelectorAll('[href="http://some.domain.com"]').length, 1);
    ok(fragment.querySelector('a[href="http://some.domain.com"]'));
    strictEqual(fragment.querySelectorAll('a[href="http://some.domain.com"]').length, 1);

    div.parentNode.removeChild(div);
});

test('non-added to DOM', function () {
    var link = document.createElement('a');
    var div  = document.createElement('div');

    link.setAttribute('href', 'http://some.domain.com');
    div.appendChild(link);

    ok(div.querySelector('[href="http://some.domain.com"]'));
});

test('javascript protocol', function () {
    var link = document.createElement('a');

    link.setAttribute('href', 'javascript:performCommand(cmd);');
    document.body.appendChild(link);

    ok(document.querySelector('[href="javascript:performCommand(cmd);"]'));

    link.parentNode.removeChild(link);
});

test('complex selector', function () {
    var link     = document.createElement('a');
    var divOuter = document.createElement('div');
    var divInner = document.createElement('div');

    divOuter.setAttribute('data-id', '123456');
    divInner.className = 'inner';
    link.setAttribute('href', 'http://some.domain.com');
    divOuter.appendChild(divInner);
    divInner.appendChild(link);
    document.body.appendChild(divOuter);

    ok(document.querySelector('div[data-id="123456"] div.inner a[href="http://some.domain.com"]'));

    divOuter.parentNode.removeChild(divOuter);
});

// http://w3c-test.org/dom/nodes/ParentNode-querySelector-All.html
test('special selectors', function () {
    var div = document.createElement('div');

    div.appendChild(document.createElement('null'));
    div.appendChild(document.createElement('undefined'));

    ok(div.querySelector(null));

    /*eslint-disable no-undefined*/
    ok(div.querySelectorAll(undefined));
    /*eslint-enable no-undefined*/
});

module('resgression');

asyncTest('document.write for several tags in iframe (T215136)', function () {
    expect(2);

    var src    = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/iframe-with-doc-write.html');
    var iframe = document.createElement('iframe');

    iframe.setAttribute('src', src);
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var div = iframe.contentDocument.querySelector('#parent');

            strictEqual(div.children.length, 3);
            strictEqual(div.parentNode.lastElementChild, div);

            iframe.parentNode.removeChild(iframe);
            start();
        });

    document.body.appendChild(iframe);
});

test('document.write for page html (T190753)', function () {
    var $div            = $('<div>').appendTo('body');
    var $iframe         = $('<iframe id="test5">');
    var script          = 'var a = [1,2], b = 0; window.test = a[b];';
    var processedScript = processScript(script, true, false).replace(/\s*/g, '');

    overrideDomMeth($div[0]);
    $div[0].appendChild($iframe[0]);

    ok(script.replace(/\s*/g, '') !== processedScript);

    $iframe[0].contentDocument.write('<html><head><script>' + script + '<\/script><head><body></body></html>');

    strictEqual($iframe[0].contentWindow.test, 1);

    var scripts = $iframe[0].contentDocument.getElementsByTagName('script');

    strictEqual(scripts.length, 1);
    strictEqual(scripts[0].text.replace(/\s*/g, ''), processedScript);

    $iframe.remove();
    $div.remove();
});

if (browserUtils.isFirefox || browserUtils.isIE11) {
    asyncTest('override window methods after document.write call (T239109)', function () {
        var $iframe = $('<iframe id="test_wrapper">');

        window.top.onIframeInited = function (window) {
            var iframeIframeSandbox = window['%hammerhead%'].sandbox.iframe;

            iframeIframeSandbox.on(iframeIframeSandbox.RUN_TASK_SCRIPT, initIframeTestHandler);
            iframeIframeSandbox.off(iframeIframeSandbox.RUN_TASK_SCRIPT, iframeIframeSandbox.iframeReadyToInitHandler);
        };

        $iframe[0].setAttribute('src', 'javascript:\'' +
                                       '   <html><body><script>' +
                                       '       window.top.onIframeInited(window);' +
                                       '       var quote = String.fromCharCode(34);' +
                                       '       if(true){document.write("<iframe id=" + quote + "test_iframe" + quote + "></iframe>");}' +
                                       '       if(true){document.getElementById("test_iframe").contentDocument.write("<body><script>document.body.innerHTML = " + quote + "<div></div>" + quote + ";</s" + "cript></body>");}' +
                                       '   </sc' + 'ript></body></html>' +
                                       '\'');

        $iframe.appendTo('body');

        var id = setInterval(function () {
            var testIframe = $iframe[0].contentDocument.getElementById('test_iframe');

            if (testIframe && testIframe.contentDocument.body.children[0].tagName.toLowerCase() === 'div') {
                clearInterval(id);
                ok(true);
                $iframe.remove();
                start();
            }
        }, 10);

    });
}

if (!browserUtils.isFirefox) {
    asyncTest('document.write([]) in iframe (T239131)', function () {
        var iframe  = document.createElement('iframe');

        iframe.id = 'test04';
        window.QUnitGlobals.waitForIframe(iframe)
            .then(function () {
                // NOTE: Some browsers remove their documentElement after a "write([])" call. Previously, if the
                // documentElement was null, "overrideDomMethods" failed with the 'Maximum call stack size exceeded' error.
                iframe.contentDocument.write([]);
                ok(true);
                iframe.contentDocument.close();
                iframe.parentNode.removeChild(iframe);
                start();
            });
        document.body.appendChild(iframe);
    });
}

asyncTest('document.write, document.writeln with multiple parameters (T232454)(GH-409)(GH-411)', function () {
    var performTestWrite = function (doc) {
        doc.write('w1', 'w2', 'w3');
        doc.writeln('wl1', 'wl2', 'wl3');
        doc.writeln('wl4');
        doc.writeln();
        doc.write();
    };
    var getNativeDocumentWriteResult = function () {
        return new Promise(function (resolve) {
            var iframe            = nativeMethods.createElement.call(document, 'iframe');
            var nativeWriteResult = null;

            iframe.id = 'iframe_for_getting_native_value';
            window.QUnitGlobals.waitForIframe(iframe)
                .then(function () {
                    var iframeDocument    = iframe.contentDocument;

                    performTestWrite(iframeDocument);

                    nativeWriteResult = iframeDocument.body.textContent;
                    iframe.parentNode.removeChild(iframe);

                    resolve(nativeWriteResult);
                });
            nativeMethods.appendChild.call(document.body, iframe);
        });
    };

    var iframe = document.createElement('iframe');

    iframe.id = 'test_jksnv523';
    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            return getNativeDocumentWriteResult();
        })
        .then(function (nativeDocumentWriteResult) {
            var iframeDocument    = iframe.contentDocument;

            performTestWrite(iframeDocument);
            strictEqual(iframeDocument.body.textContent, nativeDocumentWriteResult);
            iframe.parentNode.removeChild(iframe);
            start();
        });
    document.body.appendChild(iframe);
});

asyncTest('the onDocumentCleaned event is not raised after calling document.write (GH-253)', function () {
    expect(1);

    var iframe  = document.createElement('iframe');
    var src     = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/iframe-without-document-cleaned-event.html');
    var handler = function (e) {
        window.removeEventListener('message', handler);
        strictEqual(e.data, 'success');
        iframe.parentNode.removeChild(iframe);
        start();
    };

    window.addEventListener('message', handler);
    iframe.setAttribute('src', src);
    document.body.appendChild(iframe);
});

asyncTest('document elements are overridden after document.write has been called (GH-253)', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test';
    iframe.src = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/iframe-override-elems-after-write.html');

    var onMessageHandler = function (e) {
        window.removeEventListener('message', onMessageHandler);

        var data = e.data instanceof Object ? e.data : JSON.parse(e.data);

        strictEqual(data.length, 3);

        data.forEach(function (testResult) {
            ok(testResult.success, testResult.description);
        });

        iframe.parentNode.removeChild(iframe);

        start();
    };

    window.addEventListener('message', onMessageHandler);

    document.body.appendChild(iframe);
});

asyncTest('multiple document.write with html and body tags should not break markup (GH-387)', function () {
    var iframe = document.createElement('iframe');

    iframe.id  = 'test';
    iframe.src = window.QUnitGlobals.getResourceUrl('../../../data/node-sandbox/multiple-write-with-html-and-body-tags.html');

    window.QUnitGlobals.waitForIframe(iframe)
        .then(function () {
            var doc = iframe.contentDocument;

            strictEqual(doc.querySelector('h1').innerHTML, 'Header');
            ok(/Text( text){19}/.test(doc.querySelector('p').innerHTML));
            strictEqual(doc.querySelector('a').target, '_self');
            strictEqual(doc.querySelectorAll('body > table tr > td > a > img').length, 1);

            document.body.removeChild(iframe);

            start();
        });

    document.body.appendChild(iframe);
});

test('script error when adding a comment node to DOM (GH-435)', function () {
    var commentNode = document.createComment('');

    document.documentElement.appendChild(commentNode);
    strictEqual(commentNode, document.documentElement.lastChild);

    commentNode.parentNode.removeChild(commentNode);
    ok(!commentNode.parentNode);

    var textNode = document.createTextNode('');

    document.documentElement.appendChild(textNode);
    strictEqual(textNode, document.documentElement.lastChild);

    textNode.parentNode.removeChild(textNode);
    ok(!textNode.parentNode);
});
