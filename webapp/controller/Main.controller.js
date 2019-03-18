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
						required: true
					},
					type: {
						label: "Order type",
						initialValue: "",
						required: false,
						noValueState: true
					},
					objectkey: {
						label: "Order id",
						initialValue: "",
						required: item => item.type !== ""
					},
					line: {
						label: "Item id",
						initialValue: "",
						required: item => item.type === "P" || item.type === "S"
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
				itemPopover: {
					hasError: false // Can't get formatter to refire on change to value state in fields so using this redundant prop
				},
				create: {
					message: {
						type: MessageType.None,
						text: ""
					}
				},
				selectedCount: 0,
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
		
		onTableSelectionChange(oEvent) {
			var oTable = oEvent.getSource();
			var aSelectedItems = oTable.getSelectedItems();
			this._oViewModel.setProperty("/selectedCount", aSelectedItems.length);
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
		
		sendSelectedItemsEmail() {
			const oTable = this.byId("tableMain");
			const oSelectedItems = oTable.getSelectedItems();
			
			// Testing reveals that large number of items selected (e.g. 10 or 51) doesn't work - no feedback or response
			// is given from sap.m.URLHelper.triggerEmail.  So limit to 5 materials for now - finding the
			// actual limit would require painstaking testing because it may differ on different machines and will
			// probably turn out to be a limit on the body content size in bytes and not the number of items.
			const nMaxItems = 5;
			if (oSelectedItems.length > nMaxItems) {
				MessageBox.warning("Too many items selected for sending email.  Please limit your selection to " + nMaxItems);
				return;
			}
			
			// Build email content
			const sSubject = "Urgent Board materials";
			const sItemSeparator = "\n***********************************************************************\n";
			let sBody = oSelectedItems
				.map(oTableItem => oTableItem.getBindingContextPath())
				.map(sPath => this._oODataModel.getProperty(sPath))
				.map(oItemData => this._getEmailBodyForItem(oItemData))
				.join(sItemSeparator);
			sBody = `${sItemSeparator}${sBody}${sItemSeparator}`;
			
			// Create email in outlook
			sap.m.URLHelper.triggerEmail("", sSubject, sBody);
			MessageToast.show("New draft email opened in Outlook");
		},
		
		sendItemEmail(oEvent) {
			// Get item 
			var oButton = oEvent.getSource();
			var sItemPath = oButton.getBindingContext().sPath;
			var oItemData = this._oODataModel.getProperty(sItemPath);
			
			// Build email content
			const sSubject = `Urgent Board material ${oItemData.material}`;
			if (oItemData.comments) {
				sSubject = `${sSubject}: ${oItemData.comments}`;
			}
			const sBody = this._getEmailBodyForItem(oItemData);
			
			// Create email in outlook
			sap.m.URLHelper.triggerEmail("", sSubject, sBody);
			MessageToast.show("New draft email opened in Outlook");
		},
		
		_getEmailBodyForItem(oItemData) {
			// Replace undefined values in oItemData with "" into oData
			const oData = {};
			Object.entries(oItemData)
				.forEach(([key, value]) => {
					if (value) {
						oData[key] = value;
					} else {
						oData[key] = "";
					}
				});
				
			var aLines = [
				`Material:  ${oData.material} (${oData.description})`,
				`Quantity:  ${oData.quantity} ${oData.uom}`,
				`Due:  ${oData.dueDate}`,
				`Contact:  ${oData.enteredByName}`,
				`Deliver to:  ${oData.deliverTo}`,
				`Comments:  ${oData.comments}`
			];
			
			// If we have an order, insert details below material
			if (oData.type) {
				var sOrderText = `${oData.typeText}:  ${oData.objectkey}`;
				aLines.splice(1, 0, sOrderText);
				if (oData.line) {
					var sLineText = `Item id: ${Number(oData.line)}`;
					aLines.splice(2, 0, sLineText);
				}
			}

			return aLines.join("\n");
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
		 * Validate each field before creating the item
		 */
		_validateFieldsBeforeCreate() {
			this._resetCreateFormMessage();
			var bAllValid = true;
			var oFields = this._oViewModel.getProperty("/fields");
			var oAllItemValues = this._getFieldValues();
			for (var sFieldName in oFields) {
				var oField = oFields[sFieldName];
				var bFieldValid = true;
				
				// Determine if field is required
				var bRequired;
				if (typeof oField.required === "function") {
					// Call function with all item values to determine if required
					bRequired = oField.required(oAllItemValues);
				} else {
					// Assume boolean flag
					bRequired = oField.required;
				}
				
				// Validate required field	
				if (bRequired && !oField.value) {
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
			if (!this._validateFieldsBeforeCreate()) {
				return;
			}
			
			// Create item
			this._setBusy(true);
			var oNewItemData = this._getFieldValues();
			var sPath = "/Items";
			this._oODataModel.create(sPath, oNewItemData, {
				success: (oData) => {
					this._setBusy(false);
					this.closeCreateDialog();	
					MessageToast.show("Material '" + oData.description + "' added");
					this._resetODataModel();
				},
				error: (oError) => {
					this._setBusy(false);
					this._resetODataModel();
					var sErrorMessage = utils.parseError(oError, "creating item");
					this._setCreateFormMessage(MessageType.Error, sErrorMessage);
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
			this._resetODataModel();
			this._resetFields();
			this._oViewModel.setProperty("/itemPopover/hasError", false);
			this._oViewModel.refresh();
		},
		
		_resetODataModel() {
			this._oODataModel.resetChanges(); 
			this._oODataModel.setUseBatch(false); 
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
					this._resetODataModel();
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
					this._resetODataModel();
				},
				error: this._handleSimpleODataError.bind(this)
			});
		},
		
		_handleSimpleODataError(oError) {
			this._setBusy(false);
			this._resetODataModel();
			var sMessage = utils.parseError(oError);
			MessageBox.error(sMessage);
		},
		
		confirmDeleteSelectedItems() {
			var oTable = this.byId("tableMain");
			var aSelectedItems = oTable.getSelectedItems();
			MessageBox.confirm(`Are you sure you want to delete ${aSelectedItems.length} item(s)?`, {
				onClose: (oAction) => {
					if (oAction === MessageBox.Action.OK) {
						this._deleteSelectedItems(aSelectedItems);
					}
				}
			});
		},
		
		_deleteSelectedItems(aSelectedItems) {
			// Update oDataModel in batch
			const sDeferredGroupId = "removeSelectedItems";
			this._oODataModel.setUseBatch(true);
			this._oODataModel.setDeferredGroups([sDeferredGroupId]);
			const oRequestParams = {
				groupId: sDeferredGroupId
			};
			aSelectedItems
				.map(oTableItem => oTableItem.getBindingContextPath())
				.forEach(sItemPath => {
					this._oODataModel.remove(sItemPath, oRequestParams);
				});
			
			// Submit changes
			this._setBusy(true);
			this._oODataModel.submitChanges({
				groupId: sDeferredGroupId,
				success: (oData) => {
					this._setBusy(false);
					if (!this._handleBatchResponseAndReturnErrorFlag(oData)) {
						MessageToast.show(`${aSelectedItems.length} item(s) removed`);
					}
					this._resetODataModel();
				},
				error: this._handleSimpleODataError.bind(this)
			});
		},
		
		/**
		 * Parses the oData return value from a batch submission, handling errors
		 * and return a flag if any errors were found.
		 *
		 * @param {object} oData - oData object returned by 'success' callback
		 */
		_handleBatchResponseAndReturnErrorFlag(oData) {
			let sErrorMessage = "";
			if (oData && oData.__batchResponses) {
				for (var x = 0; x < oData.__batchResponses.length; x++) {
					var oResponse = oData.__batchResponses[x];
					if ( (oResponse.statusCode && oResponse.statusCode !== "200")
						|| (!oResponse.statusCode && oResponse.response && oResponse.response.statusCode !== "200")) {
						try {
							var response = JSON.parse(oResponse.response.body);
							if (response.error && response.error.message) {
								sErrorMessage = response.error.message.value;
							}
						} catch (err) {
							sErrorMessage = "Unexpected error type/format in batch response.";
						}
					}
				}
			} else {
				sErrorMessage = "Unexpected problem / missing data in batch response.";
			}
			
			// Handle error
			if (sErrorMessage) {
				MessageBox.error(sErrorMessage);
				return true;
			} else {
				return false;
			}
		}
	});
});