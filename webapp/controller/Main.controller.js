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
		
		onInit() {
			// Get reference to ODataModel
			this._oODataModel = this.getOwnerComponent().getModel();

			// View model for view state
			this._oViewModel = new JSONModel({
				state: {
					busy: false
				},
				// Fields used in currently open item popover or in the create item dialog.
				// Note: each field will be given additional properties:
				// 'value', 'valueState' and 'valueStateText' by the _resetFields method. 
				// In the case of the Item Popover, controls are bound directly to the oODataModel
				// and the 'value' is not used.
				fields: {
					material: {
						label: "Material",
						initialValue: "",
						required: true,
						create: true,
						update: false
					},
					type: {
						label: "Order type",
						initialValue: "",
						required: false,
						noValueState: true,
						create: true,
						update: false
					},
					objectkey: {
						label: "Order id",
						initialValue: "",
						required: false,
						create: true,
						update: false
					},
					line: {
						label: "Item id",
						initialValue: "",
						required: false,
						create: true,
						update: false
					},
					quantity: {
						initialValue: null,
						label: "Quantity",
						required: true,
						create: true,
						update: true
					},
					uom: {
						initialValue: "EA",
						label: "Unit of measure",
						required: true,
						create: true,
						update: false
					},
					supplierId: {
						initialValue: "",
						label: "Supplier Id",
						required: false,
						create: true,
						update: false
					},
					dueDate: {
						label: "Due date",
						initialValue: null,
						required: false,
						create: true,
						update: false
					},
					deliverTo: {
						label: "Deliver to",
						initialValue: "",
						required: false,
						create: true,
						update: true
					},
					comments: {
						label: "Comments",
						initialValue: "",
						required: false,
						create: true,
						update: true
					}
				},
				itemPopover: {
					hasError: false // Can't get formatter to refire on change to value state in fields so using this redundant prop
				},
				create: {
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
		
		toggleSearchSettings(oEvent) {
			var oPopover = this.byId("searchSettingsPopover");
			if (oPopover.isOpen()) {
				oPopover.close();
			} else {
				oPopover.openBy(oEvent.getSource());
			}
		},
		
		showCreateDialog() {
			this._resetCreateForm();
			var oDialog = this.byId("createItemDialog");
			oDialog.open();
		},
		
		_resetCreateForm() {
			this._resetFields();
			this._resetCreateFormMessage();
			this._oViewModel.refresh();
		},
		
		_resetFields() {
			var oFields = this._oViewModel.getProperty("/fields");
			for (var sFieldName in oFields) {
				var oField = oFields[sFieldName];
				oField.value = oField.initialValue;
				oField.valueState = ValueState.None;
				oField.valueStateText = "";
			}
		},
		
		_getFieldValues() {
			var oFields = this._oViewModel.getProperty("/fields");
			var oValues = {};
			for (var sFieldName in oFields) {
				var oFormField = oFields[sFieldName];
				oValues[sFieldName] = oFormField.value;
			}
			return oValues;
		},
		
		/**
		 * Validate each field that is relevent to the nominated action
		 * 
		 * @param {string} sAction - Action: 'create' or 'update'
		 */
		_validateFields(sAction) {
			this._resetCreateFormMessage();
			var bAllValid = true;
			var oFields = this._oViewModel.getProperty("/fields");
			for (var sFieldName in oFields) {
				var oField = oFields[sFieldName];
				var bFieldValid = true;
				
				// Validate required field	
				if (oField[sAction] && oField.required && !oField.value) {
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
		
		_setCreateFormMessage(oMessageType, sMessageText) {
			this._oViewModel.setProperty("/create/message/type", oMessageType);
			this._oViewModel.setProperty("/create/message/text", sMessageText);
		},
		
		_resetCreateFormMessage() {
			this._setCreateFormMessage(MessageType.None, "");
		},
		
		closeCreateDialog() {
			this.byId("createItemDialog").close();
		},
		
		createItem() {
			// Some front end validation for required fields that oData service doesn't give
			// friendly messages if not provided.
			if (!this._validateFields('create')) {
				return;
			}
			
			// Create item
			this._setBusy(true);
			var oNewItemData = this._getFieldValues();
			var sPath = "/Items";
			var that = this;
			this._oODataModel.create(sPath, oNewItemData, {
				success: (oData) => {
					that._setBusy(false);
					that.closeCreateDialog();	
					MessageToast.show("Material '" + oData.description + "' added");
				},
				error: (oError) => {
					that._setBusy(false);
					that._oODataModel.resetChanges();
					var sErrorMessage = utils.parseError(oError, "creating item");
					that._setCreateFormMessage(MessageType.Error, sErrorMessage);
					MessageBox.error(sErrorMessage);
				}
			});
		},
		
		
		toggleItemOverflowPopover(oEvent) {
			var oButton = oEvent.getSource();
			var oItem = utils.findControlInParents("sap.m.ColumnListItem", oButton);
			var oPopover = this._getItemOverflowPopover(oItem);
			if (oPopover.isOpen()) {
				oPopover.close();
			} else {
				this._resetItemOverflowPopover();
				oPopover.openBy(oButton);
			}
		},
		
		closeItemOverflowPopover(oEvent) {
			var oButton = oEvent.getSource();
			var oPopover =  utils.findControlInParents("sap.m.ResponsivePopover", oButton);
			oPopover.close();
		},
		
		cancelItemOverflowPopover(oEvent) {
			var oButton = oEvent.getSource();
			var oPopover =  utils.findControlInParents("sap.m.ResponsivePopover", oButton);
			this._resetItemOverflowPopover();
			oPopover.close();
		},
		
		_resetItemOverflowPopover() {
			this._oODataModel.resetChanges(); 
			this._resetFields();
			this._oViewModel.setProperty("/itemPopover/hasError", false);
			this._oViewModel.refresh();
		},
	
		_getItemOverflowPopover(oItem) {
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
		
		onSearch() {
			var aSearchFields = this._oViewModel.getProperty("/search/fields");
			var sSearchValue = this._oViewModel.getProperty("/search/value");
			
			// Build filters for each active search field
			var aAllFilters = [];
			if (sSearchValue) {
				var aFieldFilters = aSearchFields
					.filter(oSearchField => oSearchField.selected)
					.map(oSearchField => new Filter({
						path: oSearchField.path,
						operator: FilterOperator.Contains,
						value1: sSearchValue
					}));
				
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
		
		_setBusy(bBusy) {
			this._oViewModel.setProperty("/state/busy", bBusy);
		},
		
		_isBusy() {
			return  this._oViewModel.getProperty("/state/busy");
		},
		
		onItemFieldChange(oEvent) {
			// NOTE the following block currently only works with controls that
			// have a 'value' property - e.g. sap.m.Input.  It will need
			// to be enhanced to work with sap.m.Select and some other controls.
			var oEventSource = oEvent.getSource();
			if (oEventSource.getValue) {
				var sItemPath = oEventSource.getBindingContext().sPath;
				var sValuePath = oEventSource.getBinding("value").sPath;
				var sNewValue = oEventSource.getValue();
			} else {
				throw new Error("'onItemFieldChange' not implemented for control type " + oEventSource.getMetadata()._sClassName);
			}
			
			// Merge new value and existing record into update record
			var oItem = this._oODataModel.getProperty(sItemPath);
			var oUpdateRec = Object.assign({}, oItem);
			oUpdateRec[sValuePath] = sNewValue;
			
			// Execute update
			var sValueStatePath = oEventSource.getBinding("valueState").sPath;
			var sValueStateTextPath = oEventSource.getBinding("valueStateText").sPath;
			this._setBusy(true);
			this._oODataModel.update(sItemPath, oUpdateRec, {
				success: () => {
					this._setBusy(false);
					this._oViewModel.setProperty(sValueStatePath, ValueState.None);
					this._oViewModel.setProperty(sValueStateTextPath, "");
					this._resetErrorFlagItemOverflowPopover();
					MessageToast.show("Item updated.");
				},
				error: (oError) => {
					this._setBusy(false);
					var sMessage = utils.parseError(oError);
					this._oViewModel.setProperty(sValueStatePath, ValueState.Error);
					this._oViewModel.setProperty(sValueStateTextPath, sMessage);
					this._resetErrorFlagItemOverflowPopover();
					
					// If this update has been triggered by the popover closing, then
					// reopen it preserving state so value state / message can be 
					// reviewed by the user
					var oPopover = utils.findControlInParents("sap.m.ResponsivePopover", oEventSource);
					if (!oPopover.isOpen()) {
						this._reopenPopoverPreservingState(oPopover);
					}
					this._oViewModel.refresh();
				}
			});
		},
		
		_resetErrorFlagItemOverflowPopover() {
			var oFields = this._oViewModel.getProperty("/fields");
			var bHasError = false;
			for (var sFieldName in oFields) {
				if (oFields[sFieldName].valueState === ValueState.Error) {
					bHasError = true;
				}
			}
			this._oViewModel.setProperty("/itemPopover/hasError", bHasError);
		},

		_reopenPopoverPreservingState(oPopover) {
			var oListItem = utils.findControlInParents("sap.m.ColumnListItem", oPopover);
			var oOverflowButton = utils.findControlInAggregation("sap.m.Button", oListItem.getAggregation("cells"));
			oPopover.openBy(oOverflowButton);
		},
		
		confirmDeleteItem(oEvent) {
			var oButton = oEvent.getSource();
			MessageBox.confirm("Are you sure you want to delete this item?", {
				onClose: (oAction) => {
					if (oAction === MessageBox.Action.OK) {
						this._deleteItem(oButton);
					}
				}
			});
		},
		
		_deleteItem(oButton) {
			var sItemPath = oButton.getBindingContext().sPath;
			this._setBusy(true);
			this._oODataModel.remove(sItemPath, {
				success: () => {
					this._setBusy(false);
					MessageToast.show("Item removed");
					var oPopover = utils.findControlInParents("sap.m.ResponsivePopover", oButton);
					oPopover.close();
				},
				error: (oError) => {
					this._setBusy(false);
					this._oDataModel.resetChanges();
					var sMessage = utils.parseError(oError);
					MessageBox.error(sMessage);
				}
			});
		}
		
	});
});