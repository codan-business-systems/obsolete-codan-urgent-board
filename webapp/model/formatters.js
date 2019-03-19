sap.ui.define([
	"sap/m/ButtonType"
], function (ButtonType) {
	"use strict";
	return {
		modifyActiveSortColumnVisible(nActiveFieldCount) {
			// Using formatter for this because complex expression binding
			// doesn't seem to be updating dynamically
			if (nActiveFieldCount) {
				return true;
			} else {
				return false;
			}
		},
		modifyActiveSortFieldButtonVisible(sSortAscending, sSortDescending) {
			// Using formatter for this because complex expression binding
			// doesn't seem to be updating dynamically
			if (sSortAscending || sSortDescending) {
				return true;
			} else {
				return false;
			}
		},
		itemOverflowButtonType: function(sNotes, sDeliverTo) {
			var oButtonType = ButtonType.Default;
			if (sNotes || sDeliverTo) {
				oButtonType = ButtonType.Emphasized;
			}
			return oButtonType;
		}
	};
});
