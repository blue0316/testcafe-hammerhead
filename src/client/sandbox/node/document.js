import SandboxBase from '../base';
import IframeSandbox from '../iframe';
import INTERNAL_LITERAL from '../../../processing/script/internal-literal';
import nativeMethods from '../native-methods';
import * as htmlUtils from '../../utils/html';
import { isFirefox, isIE, isIE9, isIE10 } from '../../utils/browser';
import { isIframeWithoutSrc, getFrameElement } from '../../utils/dom';

// NOTE: We should avoid using native object prototype methods,
// since they can be overriden by the client code. (GH-245)
var arraySlice = Array.prototype.slice;

export default class DocumentSandbox extends SandboxBase {
    constructor (nodeSandbox) {
        super();

        this.storedDocumentWriteContent = '';
        this.writeBlockCounter          = 0;
        this.nodeSandbox                = nodeSandbox;
        this.readyStateForIE            = null;
    }

    _isUninitializedIframeWithoutSrc () {
        var frameElement = getFrameElement(this.window);

        return this.window !== this.window.top && frameElement && isIframeWithoutSrc(frameElement) &&
               !IframeSandbox.isIframeInitialized(frameElement);
    }

    _beforeDocumentCleaned () {
        this.nodeSandbox.mutation.onBeforeDocumentCleaned({
            document:           this.document,
            isIframeWithoutSrc: isIframeWithoutSrc
        });
    }

    _onDocumentClosed () {
        this.nodeSandbox.mutation.onDocumentClosed({
            document:           this.document,
            isIframeWithoutSrc: isIframeWithoutSrc
        });
    }

    _overridedDocumentWrite (args, ln) {
        args = arraySlice.call(args);

        var lastArg   = args.length ? args[args.length - 1] : '';
        var isBegin   = lastArg === INTERNAL_LITERAL.documentWriteBegin;
        var isEnd     = lastArg === INTERNAL_LITERAL.documentWriteEnd;

        if (isBegin)
            this.writeBlockCounter++;
        else if (isEnd)
            this.writeBlockCounter--;

        if (isBegin || isEnd)
            args.pop();

        var str = args.join('');

        var needWriteOnEndMarker = isEnd && !this.writeBlockCounter;

        if (needWriteOnEndMarker || !this.storedDocumentWriteContent && htmlUtils.isWellFormattedHtml(str)) {
            this.writeBlockCounter          = 0;
            str                             = this.storedDocumentWriteContent + str;
            this.storedDocumentWriteContent = '';
        }
        else if (isBegin || this.storedDocumentWriteContent) {
            this.storedDocumentWriteContent += str;

            return null;
        }

        var shouldEmitEvents = (this.readyStateForIE || this.document.readyState) !== 'loading' &&
                               this.document.readyState !== 'uninitialized';

        str = htmlUtils.processHtml('' + str);

        if (shouldEmitEvents)
            this._beforeDocumentCleaned();

        // NOTE: Firefox and IE recreate a window instance during the document.write function execution (T213930).
        if ((isFirefox || isIE) && !htmlUtils.isPageHtml(str))
            str = htmlUtils.INIT_SCRIPT_FOR_IFRAME_TEMPLATE + str;

        var targetNativeMethod = ln ? nativeMethods.documentWriteLn : nativeMethods.documentWrite;
        var result             = targetNativeMethod.call(this.document, str);

        if (shouldEmitEvents) {
            this.nodeSandbox.mutation.onDocumentCleaned({
                window:             this.window,
                document:           this.document,
                isIframeWithoutSrc: isIframeWithoutSrc
            });
        }

        // NOTE: B234357
        this.nodeSandbox.overrideDomMethods(null, this.document);

        return result;
    }

    attach (window, document) {
        super.attach(window, document);

        // NOTE: https://connect.microsoft.com/IE/feedback/details/792880/document-readystat
        var frameElement = getFrameElement(window);

        if (frameElement && !isIframeWithoutSrc(frameElement) && (isIE9 || isIE10)) {
            this.readyStateForIE = 'loading';

            nativeMethods.addEventListener.call(this.document, 'DOMContentLoaded', () => this.readyStateForIE = null);
        }

        var documentSandbox = this;

        document.open = () => {
            var isUninitializedIframe = this._isUninitializedIframeWithoutSrc();

            if (!isUninitializedIframe)
                this._beforeDocumentCleaned();

            var result = nativeMethods.documentOpen.call(document);

            if (!isUninitializedIframe)
                this.nodeSandbox.mutation.onDocumentCleaned({ window, document });
            else
            // NOTE: If iframe initialization is in progress, we need to override the document.write and document.open
            // methods once again, because they were cleaned after the native document.open method call.
                this.attach(window, document);

            return result;
        };

        document.close = () => {
            // NOTE: IE10 and IE9 raise the "load" event only when the document.close method is called. We need to
            // restore the overrided document.open and document.write methods before Hammerhead injection, if the
            // window is not initialized.
            if (isIE && !IframeSandbox.isWindowInited(window))
                nativeMethods.restoreDocumentMeths(document);

            var result = nativeMethods.documentClose.call(document);

            if (!this._isUninitializedIframeWithoutSrc())
                this._onDocumentClosed();

            return result;
        };

        document.createElement = tagName => {
            var el = nativeMethods.createElement.call(document, tagName);

            this.nodeSandbox.overrideDomMethods(el);

            return el;
        };

        document.createElementNS = (ns, tagName) => {
            var el = nativeMethods.createElementNS.call(document, ns, tagName);

            this.nodeSandbox.overrideDomMethods(el);

            return el;
        };

        document.write = function () {
            return documentSandbox._overridedDocumentWrite(arguments);
        };

        document.writeln = function () {
            return documentSandbox._overridedDocumentWrite(arguments, true);
        };

        document.createDocumentFragment = function () {
            var fragment = nativeMethods.createDocumentFragment.apply(document, arguments);

            documentSandbox.nodeSandbox.overrideDomMethods(fragment);

            return fragment;
        };
    }
}
