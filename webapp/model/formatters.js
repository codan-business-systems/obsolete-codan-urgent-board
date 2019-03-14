sap.ui.define([
	"sap/m/ButtonType",
	"sap/ui/core/ValueState"
], function (ButtonType, ValueState) {
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
