import INTERNAL_ATTRS from '../../../processing/dom/internal-attributes';
import SandboxBase from '../base';
import { isNullOrUndefined, inaccessibleTypeToStr } from '../../utils/types';
import { DOCUMENT_WRITE_BEGIN_PARAM, DOCUMENT_WRITE_END_PARAM, CALL_METHOD_METH_NAME } from '../../../processing/js';
import { isWindow, isDocument, isDomElement } from '../../utils/dom';
import { isIE } from '../../utils/browser';

export default class MethodCallInstrumentation extends SandboxBase {
    constructor (messageSandbox) {
        super();

        this.methodWrappers = {
            // NOTE: When a selector that contains the ':focus' pseudo-class is used in the querySelector and
            // querySelectorAll functions, these functions return an empty result if the browser is not focused.
            // This replaces ':focus' with a custom CSS class to return the current active element in that case.
            querySelector: {
                condition: el => !isIE && (isDocument(el) || isDomElement(el)),

                method: (el, args) => {
                    var selector = args[0];

                    if (typeof selector === 'string')
                        selector = MethodCallInstrumentation._replaceFocusPseudoClass(selector);

                    return el.querySelector(selector);
                }
            },

            querySelectorAll: {
                condition: el => !isIE && (isDocument(el) || isDomElement(el)),

                method: (el, args) => {
                    var selector = args[0];

                    if (typeof selector === 'string')
                        selector = MethodCallInstrumentation._replaceFocusPseudoClass(selector);

                    return el.querySelectorAll(selector);
                }
            },

            postMessage: {
                condition: window => isWindow(window),
                method:    (contentWindow, args) => messageSandbox.postMessage(contentWindow, args)
            },

            write: {
                condition: document => !isDocument(document),
                method:    (document, args) => document.write.apply(document, MethodCallInstrumentation._removeOurWriteMethArgs(args))
            },

            writeln: {
                condition: document => !isDocument(document),
                method:    (document, args) => document.writeln.apply(document, MethodCallInstrumentation._removeOurWriteMethArgs(args))
            }
        };
    }

    // NOTE: Isolate throw statement into a separate function because JS engine doesn't optimize such functions.
    static _error (msg) {
        throw new Error(msg);
    }

    static _removeOurWriteMethArgs (args) {
        if (args.length) {
            var lastArg = args[args.length - 1];

            if (lastArg === DOCUMENT_WRITE_BEGIN_PARAM || lastArg === DOCUMENT_WRITE_END_PARAM) {
                var result = Array.prototype.slice.call(args);

                result.pop();

                return result;
            }
        }

        return args;
    }

    attach (window) {
        super.attach(window);

        window[CALL_METHOD_METH_NAME] = (owner, methName, args) => {
            if (isNullOrUndefined(owner)) {
                MethodCallInstrumentation._error('Cannot call method \'' + methName + '\' of ' +
                                                 inaccessibleTypeToStr(owner));
            }

            if (typeof owner[methName] !== 'function')
                MethodCallInstrumentation._error('\'' + methName + '\' is not a function');

            if (typeof methName !== 'string' || !this.methodWrappers.hasOwnProperty(methName))
                return owner[methName].apply(owner, args);

            return this.methodWrappers[methName].condition(owner) ?
                   this.methodWrappers[methName].method(owner, args) : owner[methName].apply(owner, args);
        };
    }

    static _replaceFocusPseudoClass (selector) {
        return selector.replace(/\s*:focus\b/gi, '[' + INTERNAL_ATTRS.focusPseudoClass + ']');
    }
}