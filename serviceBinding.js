function initModel() {
	var sUrl = "/sap/opu/odata/sap/Z_URGENT_BOARD_SRV/";
	var oModel = new sap.ui.model.odata.ODataModel(sUrl, true);
	sap.ui.getCore().setModel(oModel);
}