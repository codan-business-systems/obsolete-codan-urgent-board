sap.ui.define([
	"sap/m/ButtonType"
], function (ButtonType) {
	"use strict";
	return {
		orderText(sObjectKey, sLine) {
			let sText = "";
			if (sObjectKey) {
				sText = sObjectKey;
				if (sLine) {
					sText = `${sText}/${Number(sLine)}`;
				}
			}
			return sText;
		},
		
		typeIconSrc(sType) {
			let sSrc;
			switch (sType) {
				case "P":
					// Purchase Order
					sSrc = "sap-icon://shelf";
					break;
				case "S":
					// Sales Order
					sSrc = "sap-icon://sales-order-item";
					break;
				case "D":
					// Production Order
					sSrc = "sap-icon://factory";
					break;
				default:
					sSrc = "sap-icon://question-mark";
			}
			return sSrc;
		},
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
