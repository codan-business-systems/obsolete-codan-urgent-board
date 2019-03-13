sap.ui.define([
], function () {
	"use strict";
	return {
		/**
		 * Parse an error string or object returning a string with error message
		 *
		 * @param {(string|object)} [error] - Error object or string or null/undefined
		 * @param {string} [sActionContext] - Description of activity being performed
		 * @return {string} Error message text
		 */
		parseError: function(error, sActionContext) {
			var sErrorMessage = "";
			if (!error) {
				sErrorMessage = "";
			} else if (typeof error === "string") {
				sErrorMessage = error;
			} else {
				// Attempt to parse error to get to API message text
				if (error.responseText) {
					try {
						var responseText = JSON.parse(error.responseText);
						if (responseText.error && responseText.error.message) {
							sErrorMessage = responseText.error.message.value;
						}
					} catch (err) {
						// responseText is not JSON - probably XML which doesn't look like it can
						// be reliably parsed.  Handle the most common errors here
						if (error.statusCode && error.statusCode === 504) {
							// Error 504 - Gateway timeout.
							sErrorMessage = "504. The connection to the server timed out.";
						} else if (error.statusCode && error.statusCode === 503) {
							// Error 503 - Service unavailable.
							sErrorMessage = "503. Service unavailable";
						}
					}
				}
				
				// If unable to parse application error message, fall back to generic error
				if (!sErrorMessage) {
					sErrorMessage = "Undefined error " + sActionContext;
				}
			}
			
			return sErrorMessage;
		}		
	};
});
