// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
import './App.css'

import  { useState, useCallback, useMemo } from 'react';

// Key for storing data in localStorage
const STORAGE_KEY = 'json-merger-inputs-v2';

// --- Persistence Initialization ---
const getInitialInputs = () => {
    try {
        const savedInputs = localStorage.getItem(STORAGE_KEY);
        if (savedInputs) {
            const parsed = JSON.parse(savedInputs);
            if (Array.isArray(parsed) && parsed.every(i => typeof i === 'string')) {
                // Ensure there is at least one empty field at the end for immediate addition
                if (parsed[parsed.length - 1] !== '') {
                    return [...parsed, ''];
                }
                return parsed;
            }
        }
    } catch (e) {
        console.error("Error loading inputs from localStorage:", e);
    }
    // Default starting state
    return ['', ''];
};


// --- Core Deep Merge Logic (First Value Wins) ---
/**
 * Deeply merges two objects, where the target (first) object's values
 * take precedence over the source (second) object's values in case of conflict.
 * Non-conflicting keys from the source are added to the target.
 *
 * @param {any} target - The base object (first input).
 * @param {any} source - The object to merge into the target.
 * @returns {any} The merged object, or the target if it's a primitive/array.
 */
const deepMerge = (target, source) => {
    const targetIsObject = typeof target === 'object' && target !== null && !Array.isArray(target);
    const sourceIsObject = typeof source === 'object' && source !== null && !Array.isArray(source);

    // Rule 1: If target is not a mergeable object (primitive, array, null), it wins immediately.
    if (!targetIsObject) {
        return target;
    }

    // Rule 2: If the source is not a mergeable object, the target object structure wins.
    if (!sourceIsObject) {
        return target;
    }

    // Both are mergeable objects. Start merging.
    const output = { ...target };

    for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
            if (Object.prototype.hasOwnProperty.call(target, key)) {
                // Key exists in both. Recurse to check deeper conflict.
                output[key] = deepMerge(target[key], source[key]);
            } else {
                // Key exists only in source, add it to the output.
                output[key] = source[key];
            }
        }
    }
    return output;
};


// --- JSON Sanitization Logic ---
/**
 * Converts a JSON-like string (e.g., object literals with unquoted keys)
 * into strictly valid JSON format for parsing.
 * @param {string} str - The input string.
 * @returns {string} The sanitized string.
 */
const sanitizeInputToValidJSON = (str) => {
    // 1. Remove trailing commas (common in JS object literals)
    let cleaned = str.replace(/,\s*([}\]])/g, '$1').trim();

    // 2. Wrap unquoted keys in double quotes.
    // This regex looks for context (space, newline, {, or comma) followed by an unquoted identifier key and a colon.
    const regex = /([ \t\r\n{,]+)\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*:/g;
    cleaned = cleaned.replace(regex, '$1"$2":');

    return cleaned;
};


const App = () => {
    // Load state from localStorage on initial render
    const [jsonInputs, setJsonInputs] = useState(getInitialInputs);
    const [error, setError] = useState(null);

    // --- Input Handlers ---

    // Handles changes in individual textarea inputs
    const handleInputChange = useCallback((index, value) => {
        setJsonInputs(prevInputs => {
            const newInputs = [...prevInputs];
            newInputs[index] = value;

            // Auto-add a new empty textarea if the last one is being typed into
            // and it's not already empty.
            if (index === newInputs.length - 1 && value.trim() !== '') {
                newInputs.push('');
            }
            return newInputs;
        });
    }, []);

    // Handles removing an input field
    const handleRemoveInput = useCallback((index) => {
        if (jsonInputs.length > 1) {
            setJsonInputs(prevInputs => prevInputs.filter((_, i) => i !== index));
        }
    }, [jsonInputs.length]);

    // --- Merging and Computation (Memoized) ---

    const mergedResult = useMemo(() => {
        setError(null);
        let finalMergedObject = {};
        let firstValidObjectFound = false;

        const inputsToProcess = jsonInputs.filter(input => input.trim() !== '');

        for (let i = 0; i < inputsToProcess.length; i++) {
            const input = inputsToProcess[i];
            
            // Step 1: Sanitize the input to handle unquoted keys and trailing commas
            const sanitizedInput = sanitizeInputToValidJSON(input);

            try {
                // Step 2: Parse the sanitized input
                const currentObject = JSON.parse(sanitizedInput);

                if (typeof currentObject !== 'object' || currentObject === null || Array.isArray(currentObject)) {
                    // Skip non-object JSON values (like "hello" or 5 or [1,2]) for merging
                    continue;
                }

                if (!firstValidObjectFound) {
                    // Initialize the merge base with the first valid object found
                    finalMergedObject = currentObject;
                    firstValidObjectFound = true;
                } else {
                    // Subsequent valid objects are merged, with finalMergedObject winning conflicts
                    finalMergedObject = deepMerge(finalMergedObject, currentObject);
                }
            } catch (e) {
                // Set an error if any non-empty input is invalid JSON even after sanitization
                setError(`Parse Error in Input ${i + 1}: Check JSON format. (e.g., missing comma, single quotes used for strings, etc.)`);
                return ''; // Stop merging on the first error
            }
        }

        if (!firstValidObjectFound) {
            return '// Paste JSON objects above to start merging...';
        }
        const result = JSON.stringify(finalMergedObject, null, 2);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(inputsToProcess));
        // Return the final merged object as a pretty-printed string
        return result;
    }, [jsonInputs]);


    return (
        <div className="min-h-screen flex flex-col bg-gray-50 p-2 font-['Inter']">
            <style>{`
                /* Custom scrollbar for textareas */
                .custom-scroll::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scroll::-webkit-scrollbar-thumb {
                    background-color: #9ca3af;
                    border-radius: 3px;
                }
                .custom-scroll::-webkit-scrollbar-track {
                    background: #f3f4f6;
                }
            `}</style>
            <h1 className="text-4xl font-extrabold text-gray-800 mb-2 text-center">
                JSON Deep Merger
            </h1>
            <p className="text-center text-gray-500 mb-8">
                Merges multiple JSON objects. **Inputs are automatically saved to your browser.**
            </p>

            {error && (
                <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6 rounded-lg shadow-md" role="alert">
                    <p className="font-bold">Error:</p>
                    <p>{error}</p>
                </div>
            )}

            <div className="flex grow flex-col lg:flex-row gap-8 min-h-[80vh]">
                {/* Left Side: Input JSONs */}
                <div className="lg:w-1/2">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4">Input JSON Objects</h2>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto p-2 custom-scroll rounded-lg bg-white shadow-inner">
                        {jsonInputs.map((input, index) => (
                            <div key={index} className="flex items-start gap-2">
                                <label className="text-gray-500 font-medium pt-3 w-8 flex-shrink-0">
                                    #{index + 1}
                                </label>
                                <textarea
                                    className="w-full h-40 p-3 text-sm font-mono border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500 transition duration-150 ease-in-out resize-none shadow-sm bg-gray-50"
                                    value={input}
                                    onChange={(e) => handleInputChange(index, e.target.value)}
                                    placeholder={`Paste JSON object ${index + 1} here...`}
                                    spellCheck="false"
                                ></textarea>
                                {jsonInputs.length > 2 && (
                                    <button
                                        onClick={() => handleRemoveInput(index)}
                                        className="mt-3 p-2 text-red-500 hover:text-red-700 rounded-full transition duration-150"
                                        title="Remove this input"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Side: Merged Result */}
                <div className="lg:w-1/2 flex flex-col">
                    <h2 className="text-2xl font-semibold text-gray-700 mb-4 flex justify-between items-center">
                        Merged Result (First Wins)
                        <button
                            onClick={() => {
                                try {
                                    // Clipboard API is preferred
                                    navigator.clipboard.writeText(mergedResult);
                                } catch (e) {
                                    // Fallback for clipboard in restricted environments
                                    const temp = document.createElement('textarea');
                                    document.body.appendChild(temp);
                                    temp.value = mergedResult;
                                    temp.select();
                                    document.execCommand('copy');
                                    document.body.removeChild(temp);
                                }
                            }}
                            disabled={mergedResult.includes('// Paste JSON') || Boolean(error)}
                            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition duration-150 shadow-md"
                        >
                            Copy JSON
                        </button>
                    </h2>
                    <textarea
                        className="w-full grow p-4 text-sm font-mono border-2 border-dashed border-gray-300 rounded-lg bg-gray-800 text-green-300 resize-none shadow-xl"
                        readOnly
                        value={mergedResult}
                        spellCheck="false"
                    ></textarea>
                </div>
            </div>
        </div>
    );
}

export default App;

