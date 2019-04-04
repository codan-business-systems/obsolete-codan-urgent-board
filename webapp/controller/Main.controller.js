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
	"sap/ui/core/ValueState",
	"sap/ui/model/Sorter"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, MessageType, utils, formatters, ValueState, Sorter) {
	"use strict";

	return Controller.extend("codan.zurgentboard.controller.Main", {
		formatters: formatters,

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
						label: "Part Number",
						initialValue: "",
						required: item => !item.description,
						canSearch: true,
						canSort: true
					},
					description: {
						label: "Part Description",
						initialValue: "",
						required: item => !item.material,
						canSearch: true,
						canSort: true
					},
					type: {
						label: "Order type",
						initialValue: "",
						required: false,
						noValueState: true,
						canSort: true
					},
					objectkey: {
						label: "Order id",
						initialValue: "",
						canSearch: true,
						required: item => item.type !== "",
						canSort: true
					},
					line: {
						label: "Item id",
						initialValue: "",
						canSort: true
					},
					quantity: {
						initialValue: null,
						label: "Quantity required",
						required: item => !item.unlimitedQuantity,
						canSort: true
					},
					unlimitedQuantity: {
						initialValue: false,
						label: "Unlimited",
						required: false
					},
					quantityIssued: {
						initialValue: "0",
						label: "Quantity issued"
					},
					uom: {
						initialValue: "EA",
						label: "Unit of measure",
						required: true
					},
					dueDate: {
						label: "Due date",
						initialValue: null,
						required: false,
						canSort: true
					},
					deliverTo: {
						label: "Deliver to",
						initialValue: "",
						required: false,
						canSort: true
					},
					comments: {
						label: "Comments",
						initialValue: "",
						required: false
					},
					enteredByName: {
						label: "Contact",
						initialValue: "",
						canSearch: true,
						canSort: true
					},
					supplierName: {
						label: "Supplier",
						initialValue: "",
						canSearch: true,
						canSort: false
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
					fields: [] // populated in _initSearchFields()
				},
				sort: {
					fields: [], // populated in _initSortFields()
					activeFieldCount: 0 // populated in _updateSortActiveFieldCount()
				}
			});
			this.getView().setModel(this._oViewModel, "viewModel");

			this._initSearchFields();
			
			// Check if we have default sort values stored in the backend
			var that = this;

			const oCommonModel = this.getOwnerComponent().getModel("common");
			this._setBusy(true);
			oCommonModel.metadataLoaded().then(() => {
				oCommonModel.read("/AppParameters", {
					filters: [new Filter({
						path: "application",
						operator: FilterOperator.EQ,
						value1: "URGENT_BOARD"
					})],
					success: (oData) => {
						const oResult = oData.results.find((oRes) => oRes.name === "SORT");
						
						that._initSortFields(oResult.value);
						this._setBusy(false);
					},
					error: () => {
						that._initSortFields();
						this._setBusy(false);
					}
				});
			});
		},

		/**
		 * Builds property 'search/fields' in view model based on field
		 * metadata in property '/fields'
		 */
		_initSearchFields() {
			var oFields = this._oViewModel.getProperty("/fields");
			var aSearchFields = Object.entries(oFields)
				.filter(([, oField]) => oField.canSearch)
				.map(([sKey, oField]) => Object.assign({
					path: sKey,
					searchSelected: true
				}, oField));
			this._oViewModel.setProperty("/search/fields", aSearchFields);
		},

		/**
		 * Builds property 'sort/fields' in view model based on field
		 * metadata in property '/fields'
		 * 
		 * Optional sStartValues => Default sort values (eg on load from backend)
		 */
		_initSortFields(sStartValues) {
			var oFields = this._oViewModel.getProperty("/fields");
			var aStartValues = sStartValues ? sStartValues.split(";") : [];
			aStartValues = aStartValues.map((sStartValue) => {
				var aParts = sStartValue.split("(");
				if (aParts.length < 2) {
					return "";
				}
				return {
					path: aParts[0],
					direction: aParts[1][0]
				};
			});
			var aSortFields = Object.entries(oFields)
				// Filter out unsortable fields
				.filter(([, oField]) => oField.canSort)
				// Build sort field object from key and field data returned
				.map(([sKey, oField]) => ({
					path: sKey,
					label: oField.label,
					initialPosition: oField.initialSortPosition,
					sortAscending: false, // May be changed by user
					sortDescending: false, // May be changed by user
					canMoveUp: false, // Will be set in _setSortFieldCanMove()
					canMoveDown: false // Will be set in _setSortFieldCanMove()
				}))
				// Check if a default setting exists
				.map((oField) => {
					var startValueIndex = aStartValues.findIndex((o) => o.path === oField.path.toUpperCase());
					
					if (startValueIndex >= 0) {
						oField.sortAscending = aStartValues[startValueIndex].direction === "A";
						oField.sortDescending = aStartValues[startValueIndex].direction !== "A";
						oField.initialPosition = startValueIndex;
					}
					return oField;
				})
				// Sort by initial sort position
				.sort((oA, oB) => {
					if (typeof oA.initialPosition === "undefined" && typeof oB.initialPosition === "undefined") {
						return 0;
					} else if (typeof oA.initialPosition === "undefined") {
						return 1;
					} else if (typeof oB.initialPosition === "undefined") {
						return -1;
					} else {
						return oA.initialPosition - oB.initialPosition;
					}
				})
				// Set 'canMoveUp' and 'canMoveDown'
				.map(this._setSortFieldCanMove);

				this._updateTableSort(aSortFields);
				this._oViewModel.setProperty("/sort/fields", aSortFields);
				this._updateSortActiveFieldCount(aSortFields);	
		},

		_setSortFieldCanMove(oField, nIndex, aFields) {
			if (oField.sortAscending || oField.sortDescending) {
				if (nIndex > 0) {
					oField.canMoveUp = true;
				} else {
					oField.canMoveUp = false;
				}

				const oNextField = aFields[nIndex + 1];
				if (oNextField && (oNextField.sortAscending || oNextField.sortDescending)) {
					oField.canMoveDown = true;
				} else {
					oField.canMoveDown = false;
				}
			} else {
				oField.canMoveUp = false;
				oField.canMoveDown = false;
			}
			return oField;
		},

		onTableSelectionChange() {
			var oTable = this.byId("tableMain");
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

		toggleSortSettings(oEvent) {
			var oPopover = this.byId("sortSettingsPopover");
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

			// Get item data for selected items
			const aItemData = oSelectedItems
				.map(oTableItem => oTableItem.getBindingContextPath())
				.map(sPath => this._oODataModel.getProperty(sPath));

			// Build default recipients
			const sRecipients = aItemData
				.map(oItemData => oItemData.contactEmail)
				.reduce((aUnique, sUserId) => {
					if (!aUnique.includes(sUserId)) {
						aUnique.push(sUserId);
					}
					return aUnique;
				}, [])
				.join("; ");

			// Build email content
			const sSubject = "Urgent Board materials";
			const sItemSeparator = "\n***********************************************************************\n";
			let sBody = aItemData
				.map(oItemData => this._getEmailBodyForItem(oItemData))
				.join(sItemSeparator);
			sBody = `${sItemSeparator}${sBody}${sItemSeparator}`;

			// Create email in outlook
			sap.m.URLHelper.triggerEmail(sRecipients, sSubject, sBody);
			MessageToast.show("New draft email opened in Outlook");
		},

		sendItemEmail(oEvent) {
			// Get item 
			var oButton = oEvent.getSource();
			var sItemPath = oButton.getBindingContext().sPath;
			var oItemData = this._oODataModel.getProperty(sItemPath);

			// Build email content
			let sSubject = `Urgent Board material ${oItemData.material}`;
			if (oItemData.comments) {
				sSubject = `${sSubject}: ${oItemData.comments}`;
			}
			const sBody = this._getEmailBodyForItem(oItemData);

			// Create email in outlook
			sap.m.URLHelper.triggerEmail(oItemData.contactEmail, sSubject, sBody);
			MessageToast.show("New draft email opened in Outlook");
		},

		clearSelections() {
			this.byId("tableMain").removeSelections(true);
			this.onTableSelectionChange();
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
				`Quantity required:  ${
						oData.unlimitedQuantity ? 'unlimited' : oData.quantity
					} ${
						oData.unlimitedQuantity ? '' : oData.uom
					}`,
				`Quantity issued:  ${oData.quantityIssued} ${oData.uom}`,
				`Quantity remaining:  ${
						oData.unlimitedQuantity ? 'unlimited' : oData.quantity
					} ${
						oData.unlimitedQuantity ? '' : oData.uom
					}`,
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
			this._oODataModel.setUseBatch(false);
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
			var oPopover = utils.findControlInParents("sap.m.ResponsivePopover", oButton);
			oPopover.close();
		},

		cancelItemOverflowPopover(oEvent) {
			var oButton = oEvent.getSource();
			var oPopover = utils.findControlInParents("sap.m.ResponsivePopover", oButton);
			this._resetItemOverflowPopover();
			this._resetErrorFlagItemOverflowPopover();
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
				oPopover.attachAfterClose(this._preventPopoverCloseIfError.bind(this));
				oItem.addDependent(oPopover);
			} else {
				oPopover = utils.findControlInAggregation("sap.m.ResponsivePopover", aDependents);
			}
			return oPopover;
		},

		_preventPopoverCloseIfError(oEvent) {
			const bHasError = this._oViewModel.getProperty("/itemPopover/hasError");
			if (bHasError) {
				this._reopenPopoverPreservingState(oEvent.getSource());
			}
		},
		
		validateDateRange(event) {
			if (event.getParameter("valid")) {
				event.getSource().setValueState(sap.ui.core.ValueState.None);
				this.onSearch();
			} else {
				event.getSource().setValueState(sap.ui.core.ValueState.Error);
			}
		},
		
		setDueInPast() {
			this._oViewModel.setProperty("/searchDateFrom", new Date("01/01/2000"));	
			this._oViewModel.setProperty("/searchDateTo", new Date());
			this.onSearch();
		},
		
		setDueToday() {
			this._oViewModel.setProperty("/searchDateFrom", new Date());
			this.onSearch();
		},
		
		setDueInFuture() {
			var today = new Date();
			this._oViewModel.setProperty("/searchDateFrom", new Date());
			this._oViewModel.setProperty("/searchDateTo", new Date(today.getFullYear() + 2, today.getMonth(), today.getDate()));
			this.onSearch();
		},
		
		clearDateSelection() {
			this._oViewModel.setProperty("/searchDateFrom", null);
			this._oViewModel.setProperty("/searchDateTo", null);
			this.onSearch();
		},

		onSearch() {
			var aSearchFields = this._oViewModel.getProperty("/search/fields");
			var sSearchValue = this._oViewModel.getProperty("/search/value");
			var dSearchDateFrom = this._oViewModel.getProperty("/searchDateFrom");
			var dSearchDateTo = this._oViewModel.getProperty("/searchDateTo") || new Date(dSearchDateFrom);

			// Build filters for each active search field
			var aAllFilters = [];
			if (sSearchValue) {
				var aFieldFilters = aSearchFields
					.filter(oSearchField => oSearchField.searchSelected)
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

			if (dSearchDateFrom) {
				dSearchDateTo.setHours(23);
				dSearchDateTo.setMinutes(59);
				dSearchDateTo.setSeconds(59);
				aAllFilters.push(new Filter({
					path: 'dueDate',
					operator: FilterOperator.BT,
					value1: dSearchDateFrom,
					value2: dSearchDateTo
				}));
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
			return this._oViewModel.getProperty("/state/busy");
		},

		onItemFieldChange(oEvent) {
			const oEventSource = oEvent.getSource();
			const sItemPath = oEventSource.getBindingContext().sPath;
			let sValuePath;
			let sNewValue;
			let sValueStatePath = oEventSource.getBinding("valueState").sPath;
			let sValueStateTextPath;
			if (oEventSource.getMetadata()._sClassName === "sap.m.DatePicker") {
				sValuePath = oEventSource.getBinding("value").sPath;
				sNewValue = oEventSource.getDateValue();
				sValueStateTextPath = oEventSource.getBinding("valueStateText").sPath;
			} else if (oEventSource.getMetadata()._sClassName === "sap.m.CheckBox") {
				sValuePath = oEventSource.getBinding("selected").sPath;
				sNewValue = oEventSource.getSelected();
			} else {
				sValuePath = oEventSource.getBinding("value").sPath;
				sNewValue = oEventSource.getValue();
				sValueStateTextPath = oEventSource.getBinding("valueStateText").sPath;
			}

			// Merge new value and existing record into update record
			var oItem = this._oODataModel.getProperty(sItemPath);
			var oUpdateRec = Object.assign({}, oItem);
			oUpdateRec[sValuePath] = sNewValue;

			// Execute update
			this._setBusy(true);
			this._oODataModel.setUseBatch(false);
			this._oODataModel.update(sItemPath, oUpdateRec, {
				success: () => {
					this._setBusy(false);
					this._oViewModel.setProperty(sValueStatePath, ValueState.None);
					if (sValueStateTextPath) {
						this._oViewModel.setProperty(sValueStateTextPath, "");
					}
					this._resetErrorFlagItemOverflowPopover();
					MessageToast.show("Item updated.");
					this._resetODataModel();
				},
				error: (oError) => {
					this._setBusy(false);
					var sMessage = utils.parseError(oError);
					this._oViewModel.setProperty(sValueStatePath, ValueState.Error);
					if (sValueStateTextPath) {
						this._oViewModel.setProperty(sValueStateTextPath, sMessage);
					}
					this._resetErrorFlagItemOverflowPopover();
					this._oViewModel.refresh();

					// If this update has been triggered by the popover closing, then
					// reopen it preserving state so value state / message can be 
					// reviewed by the user
					var oPopover = utils.findControlInParents("sap.m.ResponsivePopover", oEventSource);
					if (!oPopover.isOpen()) {
						this._reopenPopoverPreservingState(oPopover);
					}
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
			// Ask user to confirm
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
			this._oODataModel.setUseBatch(false);
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
					if ((oResponse.statusCode && oResponse.statusCode !== "200") || (!oResponse.statusCode && oResponse.response && oResponse.response
							.statusCode !== "200")) {
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
		},

		onPressSortAscending(oEvent) {
			this._onPressSortDirection("ASC", oEvent);
		},

		onPressSortDescending(oEvent) {
			this._onPressSortDirection("DESC", oEvent);
		},

		onPressSortRemove(oEvent) {
			this._onPressSortDirection("", oEvent);
		},

		onPressSortMoveDown(oEvent) {
			this._onPressSortMovePosition(1, oEvent);
		},

		onPressSortMoveUp(oEvent) {
			this._onPressSortMovePosition(-1, oEvent);
		},

		_onPressSortMovePosition(nChange, oEvent) {
			const oButton = oEvent.getSource();
			const sSelectedFieldPath = oButton.getBindingContext("viewModel").sPath;
			let oSelectedField = this._oViewModel.getProperty(sSelectedFieldPath);
			const aSortFields = this._oViewModel.getProperty("/sort/fields");
			const nIndex = aSortFields.findIndex(oSortField => oSortField.path === oSelectedField.path);
			const nNewIndex = nIndex + nChange;
			if (nNewIndex > -1 && nNewIndex < aSortFields.length) {
				// Swap position of selected and target postion fields
				this._swapArrayElements(nIndex, nNewIndex, aSortFields);

				// Update 'canMoveUp/Down' properties of all fields
				aSortFields.forEach(this._setSortFieldCanMove);

				this._oViewModel.refresh();
				this._updateTableSort(aSortFields);
			}
		},

		_onPressSortDirection(sDirection, oEvent) {
			// Get sort fields and remember current state
			const aSortFields = this._oViewModel.getProperty("/sort/fields");
			const nIndexFirstInactive = aSortFields.findIndex(oField => !oField.sortAscending && !oField.sortDescending);
			const nIndexLastActive = nIndexFirstInactive - 1;

			// Get sort field clicked on
			const oButton = oEvent.getSource();
			const sSelectedPath = oButton.getBindingContext("viewModel").sPath;
			const oSelected = this._oViewModel.getProperty(sSelectedPath);
			const nSelectedIndex = aSortFields.findIndex(oField => oField.path === oSelected.path);

			// Move sort field according to old and new active
			const bOldActive = oSelected.sortAscending || oSelected.sortDescending;
			const bNewActive = sDirection;
			if (!bOldActive && bNewActive) {
				// 	If making active, move element up to end of active elements
				this._swapArrayElements(nSelectedIndex, nIndexFirstInactive, aSortFields);
			} else if (bOldActive && !bNewActive) {
				// If making inactive, move element down until it is first inactive element
				for (let x = nSelectedIndex; x < nIndexLastActive; x++) {
					this._swapArrayElements(x, x + 1, aSortFields);
				}
			}

			// Update sort direction
			switch (sDirection) {
			case "ASC":
				oSelected.sortAscending = true;
				oSelected.sortDescending = false;
				break;
			case "DESC":
				oSelected.sortAscending = false;
				oSelected.sortDescending = true;
				break;
			default:
				oSelected.sortAscending = oSelected.sortDescending = false;
			}

			// Update 'canMoveUp/Down' properties of all fields
			aSortFields.forEach(this._setSortFieldCanMove);

			// Update 'sort/activeFieldCount' property
			this._updateSortActiveFieldCount(aSortFields);
			this._oViewModel.refresh();
			this._updateTableSort(aSortFields);
		},

		_updateSortActiveFieldCount(aSortFields) {
			const nCount = aSortFields
				.reduce((nRunningTotal, oField) => {
					if (oField.sortAscending || oField.sortDescending) {
						return nRunningTotal + 1;
					} else {
						return nRunningTotal;
					}
				}, 0);
			this._oViewModel.setProperty("/sort/activeFieldCount", nCount);
		},

		_swapArrayElements(nIndexA, nIndexB, aArray) {
			let oTemporary = aArray[nIndexA];
			aArray[nIndexA] = aArray[nIndexB];
			aArray[nIndexB] = oTemporary;
		},

		_updateTableSort(aSortFields) {

			// Some properties need custom sort functions - these are defined below
			// Date sort is required due to bug in current version of UI5 where 
			// if a date value is blank the item is not sorted.
			// Note that this only seems to be a problem with 1.38.6 => seems to be fixed
			// in future versions
			const fDateSort = (d1, d2) => {
				if (d1 === d2) {
					return 0;
				}

				if (!d1 || !d2) {
					return !d1 ? -1 : 1;
				} else {
					if (d1 === d2) {
						return 0;
					} else {
						return d1 < d2 ? -1 : 1;
					}
				}
			};
			
			// Function to determine which comparator function to use
			const getComparator = (path) => {
				switch(path) {
					case "dueDate":
						return fDateSort;
					default:
						return null;
				}	
			};

			// Build sorters for each active sort field
			var aSorters = aSortFields
				.filter(oSortField => oSortField.sortAscending || oSortField.sortDescending)
				.map(oSortField => new Sorter({
					path: oSortField.path,
					descending: oSortField.sortDescending,
					comparator: getComparator(oSortField.path)
				}));

			// Apply sort
			var oTable = this.byId("tableMain");
			var oBinding = oTable.getBinding("items");
			oBinding.sort(aSorters);
			
			// Persist sort settings
			this._persistSortSettings(aSortFields);
		},
		
		// Save the user's settings choices via the oData service
		_persistSortSettings(aSortFields) {
			var model = this.getView().getModel("common");
			
			if (!model) {
				return;
			}
			
			const sSortParams = aSortFields.map((oSortField) => {
				if (oSortField.sortAscending) {
					return oSortField.path.toUpperCase() + "(A);";
				} else if (oSortField.sortDescending) {
					return oSortField.path.toUpperCase() + "(D);";
				} else {
					return "";
				}
			}).join("");
			
			model.create("/AppParameters",{
				application: "URGENT_BOARD",
				name: "SORT",
				value: sSortParams			
			});
			
			model.metadataLoaded().then(() => model.submitChanges());
			
		},
		
		navToGoodsReceipt(event) {
			const oSourceObject = event.getSource().getBindingContext().getObject(),
				  sPurchaseOrder = oSourceObject.type === "P" ? oSourceObject.objectkey : "",
				  oNav = sap.ushell.Container.getService("CrossApplicationNavigation");
			
			var hash = (oNav && oNav.hrefForExternal({
				target : {
					semanticObject: "GoodsReceipt",
					action: "create"
				},
				params: sPurchaseOrder ? {
					"purchaseOrder": sPurchaseOrder
				} : {}
			})) || "";
			
			oNav.toExternal({
				target: {
					shellHash: hash
				}
			});
			
		},
		
		navToGoodsReceiptSelected() {
			var oTable = this.byId("tableMain");
			var aSelectedItems = oTable.getSelectedItems(),
				sPurchaseOrders = "",
				oNav = sap.ushell.Container.getService("CrossApplicationNavigation"),
				oModel = this._oODataModel;
				
			aSelectedItems
				.map((oTableItem) => oTableItem.getBindingContextPath())
				.map((sPath) => oModel.getProperty(sPath))
				.forEach((oItem) => { 
					if (oItem.type === "P") {
						sPurchaseOrders = sPurchaseOrders ? sPurchaseOrders + ";" + oItem.objectkey : oItem.objectkey;
					}
				});
			
			var hash = (oNav && oNav.hrefForExternal({
				target : {
					semanticObject: "GoodsReceipt",
					action: "create"
				},
				params: sPurchaseOrders ? {
					"purchaseOrder": sPurchaseOrders
				} : {}
			})) || "";
			
			oNav.toExternal({
				target: {
					shellHash: hash
				}
			});
			
		}
	});
});