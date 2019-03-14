sap.ui.define([
	"sap/m/ButtonType"
], function (ButtonType) {
	"use strict";
	return {
		itemOverflowButtonType: function(sNotes) {
			var oButtonType = ButtonType.Default;
			if (sNotes) {
				oButtonType = ButtonType.Emphasized;
			}
			return oButtonType;
		}
	};
});
