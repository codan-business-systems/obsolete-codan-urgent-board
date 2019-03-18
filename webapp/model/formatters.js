sap.ui.define([
	"sap/m/ButtonType"
], function (ButtonType) {
	"use strict";
	return {
		supplierNameText(sSupplierName) {
			if (sSupplierName) {
				return `(${sSupplierName})`;
			} else {
				return "";
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
