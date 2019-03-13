sap.ui.define([
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/json/JSONModel",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/m/MessageBox",
	"sap/m/MessageToast",
	"sap/ui/core/MessageType",
	"codan/zurgentboard/model/utils",
	"codan/zurgentboard/model/formatters",
	"sap/ui/core/ValueState"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, MessageType, utils, formatters, ValueState) {
	"use strict";

	return Controller.extend("codan.zurgentboard.controller.Main", {
		formatters: formatters,
		_searchSettingsPopover: null,
		
		onInit: function () {
			// Get reference to ODataModel
			this._oODataModel = this.getOwnerComponent().getModel();

			// View model for view state
			this._oViewModel = new JSONModel({
				state: {
					busy: false
				},
				create: {
					// Fields on create form.  Note: each field will be given additional properties:
					// 'value', 'valueState' and 'valueStateText' by the _resetCreateForm method
					fields: {
						material: {
							label: "Material",
							initialValue: "",
							required: true
						},
						type: {
							label: "Order type",
							initialValue: "",
							required: true,
							noValueState: true
						},
						objectkey: {
							label: "Order id",
							initialValue: "",
							required: true
						},
						line: {
							label: "Item id",
							initialValue: "",
							required: true
						},
						quantity: {
							initialValue: null,
							label: "Quantity",
							required: true
						},
						uom: {
							initialValue: "EA",
							label: "Unit of measure",
							required: true
						},
						supplierId: {
							initialValue: "",
							label: "Supplier Id",
							required: false
						},
						dueDate: {
							label: "Due date",
							initialValue: null,
							required: false
						},
						deliverTo: {
							label: "Deliver to",
							initialValue: "",
							required: false
						},
						comments: {
							label: "Comments",
							initialValue: "",
							required: false
						}
					},
					message: {
						type: MessageType.None,
						text: ""
					}
				},
				referenceTypes: [{
					id: "",
					description: ""
				}, {
					id: "P",
					description: "Purchase Order"
				}, {
					id: "S",
					description: "Sales Order"
				}, {
					id: "D",
					description: "Production Order"
				}],
				search: {
					value: "",
					fields: [
						{ text: "Part Number", selected: true, path: "material" },
						{ text: "Part Description", selected: true, path: "description" },
						{ text: "Order Id", selected: true, path: "objectkey" },
						{ text: "Contact", selected: true, path: "enteredByName" }
					]
				}
			});
			this.getView().setModel(this._oViewModel, "viewModel");
		},
		
		toggleSearchSettings: function(oEvent) {
			var oPopover = this.byId("searchSettingsPopover");
			if (oPopover.isOpen()) {
				oPopover.close();
			} else {
				oPopover.openBy(oEvent.getSource());
			}
		},
		
		showCreateDialog: function() {
			this._resetCreateForm();
			var oDialog = this.byId("createItemDialog");
			oDialog.open();
		},
		
		_resetCreateForm: function() {
			var oFields = this._oViewModel.getProperty("/create/fields");
			for (var sFieldName in oFields) {
				var oField = oFields[sFieldName];
				oField.value = oField.initialValue;
				oField.valueState = ValueState.None;
				oField.valueStateText = "";
			}
			this._resetCreateFormMessage();
		},
		
		_getCreateFormValues: function() {
			var oFields = this._oViewModel.getProperty("/create/fields");
			var oValues = {};
			for (var sFieldName in oFields) {
				var oFormField = oFields[sFieldName];
				oValues[sFieldName] = oFormField.value;
			}
			return oValues;
		},
		
		_validateCreateFormInput: function() {
			this._resetCreateFormMessage();
			var bAllValid = true;
			var oFields = this._oViewModel.getProperty("/create/fields");
			for (var sFieldName in oFields) {
				var oField = oFields[sFieldName];
				var bFieldValid = true;
				
				// Validate required field	
				if (oField.required && !oField.value) {
					bFieldValid = false;
					oField.valueState = ValueState.Error;
					oField.valueStateText = "'" + oField.label + "' is required";
				}
				
				// Handle valid / invalid
				if (!bFieldValid) {
					bAllValid = false;
					if (oField.noValueState) {
						this._setCreateFormMessage(MessageType.Error, oField.valueStateText);
					}
				} else {
					oField.valueState = ValueState.None;
					oField.valueStateText = "";
				}
			}
			this._oViewModel.refresh();
			return bAllValid;
		},
		
		_setCreateFormMessage: function(oMessageType, sMessageText) {
			this._oViewModel.setProperty("/create/message/type", oMessageType);
			this._oViewModel.setProperty("/create/message/text", sMessageText);
		},
		
		_resetCreateFormMessage: function() {
			this._setCreateFormMessage(MessageType.None, "");
		},
		
		closeCreateDialog: function() {
			this.byId("createItemDialog").close();
		},
		
		createItem: function(oEvent) {
			// Some front end validation for required fields that oData service doesn't give
			// friendly messages if not provided.
			if (!this._validateCreateFormInput()) {
				return;
			}
			
			// Create item
			this._setBusy(true);
			var oNewItemData = this._getCreateFormValues();
			var sPath = "/Items";
			var that = this;
			this._oODataModel.create(sPath, oNewItemData, {
				success: function(oData, response) {
					that._setBusy(false);
					that.closeCreateDialog();	
					MessageToast.show("Material '" + oData.description + "' added");
				},
				error: function(oError) {
					that._setBusy(false);
					that._oODataModel.resetChanges();
					var sErrorMessage = utils.parseError(oError, "creating item");
					that._setCreateFormMessage(MessageType.Error, sErrorMessage);
					MessageBox.error(sErrorMessage);
				}
			});
		},
		
		toggleItemOverflowPopover: function(oEvent) {
			var oButton = oEvent.getSource();
			var oItem = utils.findControlInParents("sap.m.ColumnListItem", oButton);
			var oPopover = this._getItemOverflowPopover(oItem);
			if (oPopover.isOpen()) {
				oPopover.close();
			} else {
				oPopover.openBy(oButton);
			}
		},
		
		closeItemOverflowPopover: function(oEvent) {
			var oButton = oEvent.getSource();
			var oPopover =  utils.findControlInParents("sap.m.ResponsivePopover", oButton);
			oPopover.close();
		},
		
		
		_getItemOverflowPopover: function(oItem) {
			// Find or create popover
			var oPopover;
			var aDependents = oItem.getAggregation("dependents");
			if (!aDependents) {
				oPopover = sap.ui.xmlfragment("codan.zurgentboard.view.ItemOverflowPopover", this);
				oItem.addDependent(oPopover);
			} else {
				oPopover = utils.findControlInAggregation("sap.m.ResponsivePopover", aDependents);
			}			
			return oPopover;
		},
		
		onSearch: function() {
			var aSearchFields = this._oViewModel.getProperty("/search/fields");
			var sSearchValue = this._oViewModel.getProperty("/search/value");
			
			// Build filters for each active search field
			var aAllFilters = [];
			if (sSearchValue) {
				var aFieldFilters = aSearchFields
					.filter(function (oSearchField){
						return oSearchField.selected;
					})
					.map(function (oSearchField){
						return new Filter({
							path: oSearchField.path,
							operator: FilterOperator.Contains,
							value1: sSearchValue
						});
				});
				
				// If no field filters active, advise user that nothing will be selected
				if (!aFieldFilters.length) {
					MessageBox.warning("Nothing will be found because no search fields have been selected");
				}
				
				// Combine filters with OR statement not AND
				var oCombinedFilter = new Filter({
					filters: aFieldFilters,
					and: false
				});
				aAllFilters.push(oCombinedFilter);
			}
			
			// Apply filter
			var oTable = this.byId("tableMain");
			var oBinding = oTable.getBinding("items");
			oBinding.filter(aAllFilters);
		},
		
		_setBusy: function(bBusy) {
			this._oViewModel.setProperty("/state/busy", bBusy);
		}
	});
});