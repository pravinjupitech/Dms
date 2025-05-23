import ExcelJS from "exceljs"
import { Product } from "../model/product.model.js";
import { Warehouse } from "../model/warehouse.model.js";
import { CreateOrder } from "../model/createOrder.model.js";
import { PurchaseOrder } from "../model/purchaseOrder.model.js";
import { CustomerGroup } from "../model/customerGroup.model.js";
import { Stock } from "../model/stock.js";

export const SaveProduct = async (req, res) => {
  try {
    let groupDiscount = 0;
    if (req.body.id) {
      const existing = await Product.findOne({ status: "Active", database: req.body.database, id: req.body.id })
      if (existing) {
        return res.status(404).json({ message: "id already exist", status: false })
      }
    } else {
      return res.status(400).json({ message: "product id required", status: false })
    }
    const group = await CustomerGroup.find({ database: req.body.database, status: "Active" })
    if (group.length > 0) {
      const maxDiscount = group.reduce((max, group) => {
        return group.discount > max.discount ? group : max;
      });
      groupDiscount = maxDiscount.discount;
    }
    if (req.files) {
      let images = [];
      req.files.map((file) => {
        images.push(file.filename);
      });
      req.body.Product_image = images;
    }
    if (!req.body.ProfitPercentage || req.body.ProfitPercentage === 0) {
      req.body.SalesRate = req.body.Purchase_Rate * 1.03;
      req.body.Product_MRP = (req.body.SalesRate) * (1 + req.body.GSTRate / 100) * (1 + groupDiscount / 100);
    }
    if (req.body.Opening_Stock) {
      req.body.qty = req.body.Opening_Stock
    }
    if (req.body.Product_Title && req.body.SubCategory && req.body.category) {
      // let last4 = '';
      // let existName = req.body.Product_Title.split(" ");
      // let fname = existName[0];
      // const hsn = req.body.HSN_Code.trim();
      // last4 = hsn.slice(-4);
      req.body.sId = `${req.body.category}-${req.body.SubCategory}-${req.body.Product_Title}`;
    }
    const product = await Product.create(req.body);
    await addProductInWarehouse1(req.body, product.warehouse, product)
    // await addProductInStock(req.body, product.warehouse, product)
    return product ? res.status(200).json({ message: "product save successfully", status: true }) : res.status(400).json({ message: "something went wrong", status: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error", status: false });
  }
};
export const ViewProduct = async (req, res, next) => {
  try {
    const userId = req.params.id;
    const database = req.params.database;
    const product = await Product.find({ database: database, status: 'Active' }).sort({ sortorder: -1 }).populate({ path: "warehouse", model: "warehouse" });
    return res.status(200).json({ Product: product, status: true })
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error", status: false });
  }
};
export const ViewProductForPurchase = async (req, res, next) => {
  try {
    const database = req.params.database;
    const product = await Product.find({ database: database, status: 'Active' }).sort({ sortorder: -1 }).populate({ path: "warehouse", model: "warehouse" });
    return res.status(200).json({ Product: product, status: true })
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error", status: false });
  }
};
export const ViewProductById = async (req, res, next) => {
  try {
    let product = await Product.findById({ _id: req.params.id })
    return product ? res.status(200).json({ Product: product, status: true }) : res.status(404).json({ error: "Not Found", status: false });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error", status: false });
  }
};
export const DeleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById({ _id: req.params.id });
    if (!product) {
      return res.status(404).json({ error: "Not Found", status: false });
    }
    const purchageOrder = await PurchaseOrder.find({ "orderItems.productId": req.params.id, status: { $in: ["pending", "completed"] } })
    const salesOrder = await CreateOrder.find({
      "orderItems.productId": req.params.id,
      status: { $in: ["pending", "completed"] }
    });
    if (purchageOrder && purchageOrder.length > 0) {
      return res.json({ message: "Product is used in Purchase order", status: false })
    }
    if (salesOrder && salesOrder.length > 0) {
      return res.json({ message: "Product is used in Sales order", status: false })
    }
    product.status = "Deactive";
    await product.save();
    const warehouse = await Warehouse.findOne({ "productItems.productId": req.params.id })
    if (warehouse) {
      warehouse.productItems = warehouse.productItems.filter(sub => sub.productId.toString() !== req.params.id);
      await warehouse.save();
    }
    return res.status(200).json({ message: "delete product successfull", status: true })
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal server error", status: false });
  }
};
export const UpdateProduct = async (req, res, next) => {
  try {
    let groupDiscount = 0;
    if (req.files) {
      let images = [];
      req.files.map((file) => {
        images.push(file.filename);
      });
      req.body.Product_image = images;
    }
    const productId = req.params.id;
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ error: "product not found", status: false });
    } else {
      const group = await CustomerGroup.find({ database: existingProduct.database, status: "Active" })
      if (group.length > 0) {
        const maxDiscount = group.reduce((max, group) => {
          return group.discount > max.discount ? group : max;
        });
        groupDiscount = maxDiscount?.discount ? maxDiscount?.discount : 0;
      }
      if (parseInt(req.body.Purchase_Rate) > existingProduct.landedCost) {
        req.body.landedCost = parseInt(req.body.Purchase_Rate);
        req.body.Purchase_Rate = parseInt(req.body.Purchase_Rate)
      } else {
        req.body.Purchase_Rate = existingProduct.landedCost;
      }
      if (!req.body.ProfitPercentage || parseInt(req.body.ProfitPercentage) === 0) {
        req.body.SalesRate = req.body.Purchase_Rate * 1.03;
        req.body.ProfitPercentage = 3;
        req.body.Product_MRP = (req.body.SalesRate) * (1 + parseInt(req.body.GSTRate) / 100) * (1 + groupDiscount / 100);
      } else {
        req.body.SalesRate = req.body.Purchase_Rate * (1 + parseInt(req.body.ProfitPercentage) / 100);
        req.body.Product_MRP = (req.body.SalesRate) * (1 + (parseInt(req.body.GSTRate) / 100)) * (1 + (groupDiscount / 100));
      }
      if (existingProduct.Opening_Stock !== parseInt(req.body.Opening_Stock)) {
        const qty = req.body.Opening_Stock - existingProduct.Opening_Stock
        req.body.qty = existingProduct.qty + qty
        await addProductInWarehouse(req.body, req.body.warehouse, existingProduct)
      }
      if (req.body.Product_Title && req.body.SubCategory && req.body.category) {
        // let last4 = '';
        // let existName = req.body.Product_Title.split(" ");
        // let fname = existName[0];
        // const hsn = req.body.HSN_Code.trim();
        // last4 = hsn.slice(-4);
        req.body.sId = `${req.body.category}-${req.body.SubCategory}-${req.body.Product_Title}`;
      }
      const updatedProduct = req.body;
      const product = await Product.findByIdAndUpdate(productId, updatedProduct, { new: true });
      return res.status(200).json({ message: "Product Updated Successfully", status: true });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error", status: false });
  }
};

export const StockAlert1 = async (req, res) => {
  try {
    const warehouses = await Warehouse.find({ database: req.params.database });
    let alertProducts = [];
    for (let warehouse of warehouses) {
      const productItems = warehouse.productItems;
      if (!productItems || productItems.length === 0) {
        continue;
      }
      const productIdsInWarehouse = productItems.map(product => product.productId);
      if (!productIdsInWarehouse || productIdsInWarehouse.length === 0) {
        continue;
      }
      const products = await Product.find({ _id: { $in: productIdsInWarehouse } }).populate({ path: "partyId", model: "customer" });
      if (!products || products.length === 0) {
        continue;
      }
      const warehouseAlertProducts = productItems
        .filter(item => {
          const product = products.find(p => p._id.toString() === item.productId.toString());
          return product && item.currentStock < product.MIN_stockalert;
        })
        .map(item => {
          const product = products.find(p => p._id.toString() === item.productId.toString());
          return {
            productId: item.productId,
            HSN_Code: product.HSN_Code,
            Product_Title: product.Product_Title,
            Product_image: product.Product_image,
            Product_Desc: product.Product_Desc,
            Product_MRP: product.Product_MRP,
            GSTRate: product.GSTRate,
            Size: item.Size,
            taxableAmount: (item.currentStock * product.Product_MRP),
            Total: ((item.currentStock * product.Product_MRP) * (100 + parseInt(product.GSTRate))) / 100,
            currentStock: item.currentStock,
            MIN_stockalert: product.MIN_stockalert,
            warehouseName: warehouse.warehouseName,
            warehosueAddress: warehouse.address,
            SupplierName: product?.partyId?.ownerName || null,
            SupplierGST: product?.partyId?.gstNumber || null
          };
        });

      alertProducts = [...alertProducts, ...warehouseAlertProducts];
    }

    return res.status(200).json({ alertProducts, status: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message, status: false });
  }
};
export const StockAlert = async (req, res) => {
  try {
    const Stock = []
    const product = await Product.find({ database: req.params.database, status: "Active" }).populate({ path: "partyId.partyId", model: "customer" }).populate({ path: "warehouse", model: "warehouse" })
    if (product.length === 0) {
      return res.status(404).json({ message: "product not found", status: false })
    }
    product.forEach(item => {
      if (item.qty < item.MIN_stockalert) {
        let StockAlerts = {
          productId: item._id.toString(),
          HSN_Code: item.HSN_Code,
          Product_Title: item.Product_Title,
          Product_image: item.Product_image,
          Product_Desc: item.Product_Desc,
          Product_MRP: item.Product_MRP,
          GSTRate: item.GSTRate,
          Size: item.Size,
          taxableAmount: (item.qty * item.Product_MRP).toFixed(2),
          Total: (((item.qty * item.Product_MRP) * (100 + parseInt(item.GSTRate))) / 100).toFixed(2),
          currentStock: item.qty,
          MIN_stockalert: item.MIN_stockalert,
          warehouseName: item.warehouse.warehouseName,
          warehosueAddress: item.warehouse.address,
          SupplierName: item?.partyId[item.partyId.length - 1]?.partyId.ownerName || null,
          SupplierGST: item?.partyId[item.partyId.length - 1]?.partyId.gstNumber || null,
          partyId: item.partyId
        };
        Stock.push(StockAlerts)
      }
    })
    return (Stock.length > 0) ? res.status(200).json({ alertProducts: Stock, status: true }) : res.status(404).json({ message: "Product Not Found", status: false })
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message, status: false });
  }
};
export const viewCurrentStock = async (req, res, next) => {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) {
      return res.status(404).json({ message: "warehouse not found", status: false });
    }
    const productItem = warehouse.productItems.find(item => item.productId === req.params.productId);
    if (!productItem) {
      return res.status(404).json({ message: "Product not found in the warehouse", status: false });
    }
    return res.status(200).json({ currentStock: productItem, status: true });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error", status: false });
  }
};

export const saveItemWithExcel = async (req, res) => {
  try {
    let groupDiscount = 0;
    let database = "database";
    let qty = "qty";
    let warehouse = "warehouse"
    let SalesRate = "SalesRate"
    let Product_MRP = "Product_MRP";
    let landedCost = "landedCost";
    let category = "category";
    let SubCategory = "SubCategory";
    const filePath = await req.file.path;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    const headerRow = worksheet.getRow(1);
    const headings = [];
    headerRow.eachCell((cell) => {
      headings.push(cell.value);
    });
    const insertedDocuments = [];
    const existingParts = [];
    const WarehouseNotExisting = []
    const existingIds = []
    const IdNotExisting = []
    for (let rowIndex = 2; rowIndex <= worksheet.actualRowCount; rowIndex++) {
      const dataRow = worksheet.getRow(rowIndex);
      const document = {};
      for (let columnIndex = 1; columnIndex <= headings.length; columnIndex++) {
        const heading = headings[columnIndex - 1];
        const cellValue = dataRow.getCell(columnIndex).value;
        document[heading] = cellValue;
      }
      document[database] = req.params.database
      if (document.HSN_Code) {
        const existingWarehouse = await Warehouse.findOne({ id: document.warehouse, database: document.database, status: "Active" })
        if (!existingWarehouse) {
          WarehouseNotExisting.push(document.warehouse)
        } else {
          document[warehouse] = existingWarehouse._id.toString()
          if (document.Product_Title && document.SubCategory&&document.category) {
            // let last4 = '';
            // let existName = document.Product_Title.split(" ");
            // let fname = existName[0];
            // const hsn = document.HSN_Code.trim();
            // last4 = hsn.slice(-4);
            document['sId'] = `${document.category}-${document.SubCategory}-${document.Product_Title}`;
          }
          if (document.id) {
            const existingId = await Product.findOne({ id: document.id, database: document.database, status: "Active" });
            if (existingId) {
              existingIds.push(document.Product_Title)
            } else {
              const group = await CustomerGroup.find({ database: document.database, status: "Active" })
              if (group.length > 0) {
                const maxDiscount = group.reduce((max, group) => {
                  return group.discount > max.discount ? group : max;
                });
                groupDiscount = maxDiscount.discount;
              }
              if (!document.ProfitPercentage || document.ProfitPercentage === 0) {
                document[SalesRate] = document.Purchase_Rate * 1.03;
                document[Product_MRP] = (document.SalesRate) * (1 + document.GSTRate / 100) * (1 + groupDiscount / 100);
              } else {
                document[SalesRate] = (document.Purchase_Rate * (document.ProfitPercentage + 100) / 100);
                document[Product_MRP] = (document.SalesRate) * (1 + document.GSTRate / 100) * (1 + groupDiscount / 100);
              }
              if (document.Opening_Stock) {
                document[qty] = document.Opening_Stock
              }
              document[landedCost] = document.Purchase_Rate
              document[category] = document.category?.toUpperCase()
              document[SubCategory] = document.SubCategory?.toUpperCase()
              const insertedDocument = await Product.create(document);
              await addProductInWarehouse1(document, insertedDocument.warehouse, insertedDocument)
              insertedDocuments.push(insertedDocument);
            }
          } else {
            IdNotExisting.push(document.Product_Title)
          }
        }
      } else {
        existingParts.push(document.Product_Title)
      }
    }
    let message = 'Data Inserted Successfully';
    if (existingParts.length > 0) {
      message = `Some product not exist hsn code: ${existingParts.join(', ')}`;
    } else if (WarehouseNotExisting.length > 0) {
      message = `warehouse not exist: ${existingParts.join(', ')}`;
    } else if (existingIds.length > 0) {
      message = `this product name  id already exist: ${existingIds.join(', ')}`;
    } else if (IdNotExisting.length > 0) {
      message = `this product name id is required : ${IdNotExisting.join(', ')}`;
    }
    return res.status(200).json({ message, status: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error', status: false });
  }
}
export const updateItemWithExcel = async (req, res) => {
  try {
    let groupDiscount = 0;
    let SalesRate = "SalesRate"
    let Product_MRP = "Product_MRP"
    let database = "database";
    let warehouse = "warehouse"
    let category = "category";
    let SubCategory = "SubCategory";
    const filePath = await req.file.path;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    const headerRow = worksheet.getRow(1);
    const headings = [];
    headerRow.eachCell((cell) => {
      headings.push(cell.value);
    });
    const insertedDocuments = [];
    const existingParts = [];
    const WarehouseNotExisting = []
    const IdNotExisting = []
    for (let rowIndex = 2; rowIndex <= worksheet.actualRowCount; rowIndex++) {
      const dataRow = worksheet.getRow(rowIndex);
      const document = {};
      for (let columnIndex = 1; columnIndex <= headings.length; columnIndex++) {
        const heading = headings[columnIndex - 1];
        const cellValue = dataRow.getCell(columnIndex).value;
        document[heading] = cellValue;
      }
      document[database] = req.params.database
        if (document.Product_Title && document.SubCategory&&document.category) {
            // let last4 = '';
            // let existName = document.Product_Title.split(" ");
            // let fname = existName[0];
            // const hsn = document.HSN_Code.trim();
            // last4 = hsn.slice(-4);
            document['sId'] = `${document.category}-${document.SubCategory}-${document.Product_Title}`;
          }
      if (document.HSN_Code) {
        const existingWarehouse = await Warehouse.findOne({ id: document.warehouse, database: document.database, status: "Active" })
        if (!existingWarehouse) {
          WarehouseNotExisting.push(document.warehouse)
        } else {
          const existProduct = await Product.findOne({ id: document.id, database: document.database, status: "Active" })
          if (!existProduct) {
            IdNotExisting.push(document.id)
          } else {
            const group = await CustomerGroup.find({ database: document.database, status: "Active" })
            if (group.length > 0) {
              const maxDiscount = group.reduce((max, group) => {
                return group.discount > max.discount ? group : max;
              });
              groupDiscount = maxDiscount.discount;
            }
            if (!document.ProfitPercentage || document.ProfitPercentage === 0) {
              document[SalesRate] = document.Purchase_Rate * 1.03;
              document[Product_MRP] = (document.SalesRate) * (1 + document.GSTRate / 100) * (1 + groupDiscount / 100);
            } else {
              document[SalesRate] = (document.Purchase_Rate * (100 + document.ProfitPercentage)) / 100;
              document[Product_MRP] = (document.SalesRate) * (1 + document.GSTRate / 100) * (1 + groupDiscount / 100);
            }
            document[warehouse] = existingWarehouse._id.toString()
            document[category] = document.category?.toUpperCase()
            document[SubCategory] = document.SubCategory?.toUpperCase()
            const filter = { id: document.id, database: req.params.database };
            const options = { new: true, upsert: true };
            const insertedDocument = await Product.findOneAndUpdate(filter, document, options);
            insertedDocuments.push(insertedDocument);
          }
        }
      } else {
        existingParts.push(document.Product_Title)
      }
    }
    let message = 'Updated Successfull !';
    if (existingParts.length > 0) {
      message = `Some product not exist hsn code: ${existingParts.join(', ')}`;
    } else if (WarehouseNotExisting.length > 0) {
      message = `warehouse not exist : ${WarehouseNotExisting.join(', ')}`;
    } else if (IdNotExisting.length > 0) {
      message = `this product's id not found : ${IdNotExisting.join(', ')}`;
    }
    return res.status(200).json({ message, status: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error', status: false });
  }
}

export const addProductInWarehouse1 = async (warehouse, warehouseId, id) => {
  try {
    const user = await Warehouse.findById({ _id: warehouseId })
    if (!user) {
      return console.log("warehouse not found")
    }
    const sourceProductItem = user.productItems.find(
      (pItem) => pItem.productId === id._id.toString());
    if (sourceProductItem) {
      sourceProductItem.currentStock = warehouse.qty
      sourceProductItem.price = warehouse.Purchase_Rate;
      sourceProductItem.totalPrice = (warehouse.qty * warehouse.Purchase_Rate);
      sourceProductItem.transferQty = warehouse.qty;
      user.markModified('productItems');
      await user.save();
    } else {
      let ware = {
        productId: id._id.toString(),
        primaryUnit: id.primaryUnit,
        secondaryUnit: id.secondaryUnit,
        secondarySize: id.secondarySize,
        currentStock: id.qty,
        transferQty: id.qty,
        price: id.Purchase_Rate,
        totalPrice: (id.qty * id.Purchase_Rate),
        gstPercentage: id.GSTRate,
        igstType: id.igstType,
        oQty: id.qty,
        oRate: id.Purchase_Rate,
        oBAmount: (((id.qty * id.Purchase_Rate) * 100) / (id.GSTRate + 100)),
        oTaxRate: (id.GSTRate),
        oTotal: (id.qty * id.Purchase_Rate),
      }
      const updated = await Warehouse.updateOne({ _id: warehouseId }, { $push: { productItems: ware }, }, { upsert: true });
    }
  } catch (error) {
    console.error(error);
  }
};
export const addProductInStock = async (warehouse, warehouseId, id) => {
  try {
    const user = await Stock.findOne({ warehouseId: warehouseId, "productItems.productId": id._id.toString() })
    const existingWarehouse = await Stock.findOne({ warehouseId: warehouseId })
    if (!user) {
      let productItems = {
        productId: id._id.toString(),
        gstPercentage: warehouse.GSTRate,
        currentStock: warehouse.qty,
        price: warehouse.Purchase_Rate,
        totalPrice: (warehouse.qty * warehouse.Purchase_Rate),
        oQty: warehouse.Opening_Stock,
        oRate: warehouse.Purchase_Rate,
        oTaxRate: warehouse.GSTRate,
        oTotal: (warehouse.qty * warehouse.Purchase_Rate),
        date: new Date()
      }
      let warehouses = {
        database: warehouse.database,
        warehouseId: warehouseId,
        closingStatus: "closing",
        productItems: productItems,
        date: new Date()
      }
      if (existingWarehouse) {
        const updated = await Stock.updateOne({ warehouseId: warehouseId }, { $push: { productItems: productItems }, }, { upsert: true });
      } else {
        await Stock.create(warehouses)
      }
    }
  } catch (error) {
    console.error(error);
  }
};
export const addProductInWarehouse = async (warehouse, warehouseId, productId) => {
  try {
    const user = await Warehouse.findById({ _id: warehouseId })
    if (!user) {
      return console.log("warehouse not found")
    }
    const sourceProductItem = user.productItems.find((pItem) => pItem.productId.toString() === productId._id.toString());
    if (sourceProductItem) {
      sourceProductItem.gstPercentage = parseInt(warehouse.GSTRate)
      sourceProductItem.currentStock = parseInt(warehouse.qty)
      sourceProductItem.price = parseInt(warehouse.Purchase_Rate);
      sourceProductItem.totalPrice = (parseInt(warehouse.qty) * parseInt(warehouse.Purchase_Rate));
      sourceProductItem.transferQty = parseInt(warehouse.qty);
      sourceProductItem.oQty = parseInt(warehouse.Opening_Stock)
      sourceProductItem.oRate = parseInt(warehouse.Purchase_Rate)
      sourceProductItem.oBAmount = (((parseInt(warehouse.Opening_Stock) * parseInt(warehouse.Purchase_Rate)) * 100) / (parseInt(warehouse.GSTRate) + 100))
      sourceProductItem.oTaxRate = parseInt(warehouse.GSTRate)
      sourceProductItem.oTotal = (parseInt(warehouse.Opening_Stock) * parseInt(warehouse.Purchase_Rate))
      user.markModified('productItems');
      await user.save();
    }
  } catch (error) {
    console.error(error);
  }
};
export const addProductInStockUpdated = async (warehouse, warehouseId, productId) => {
  try {
    const user = await Stock.findOne({ warehouseId: warehouseId })
    if (!user) {
      return console.log("warehouse not found")
    }
    const sourceProductItem = user.productItems.find((pItem) => pItem.productId.toString() === productId._id.toString());
    if (sourceProductItem) {
      sourceProductItem.gstPercentage = parseInt(warehouse.GSTRate)
      sourceProductItem.currentStock = parseInt(warehouse.qty)
      sourceProductItem.price = parseInt(warehouse.Purchase_Rate);
      sourceProductItem.totalPrice = (parseInt(warehouse.qty) * parseInt(warehouse.Purchase_Rate));
      sourceProductItem.oQty = parseInt(warehouse.Opening_Stock)
      sourceProductItem.oRate = parseInt(warehouse.Purchase_Rate)
      sourceProductItem.oTaxRate = parseInt(warehouse.GSTRate)
      sourceProductItem.oTotal = (parseInt(warehouse.Opening_Stock) * parseInt(warehouse.Purchase_Rate))
      user.markModified('productItems');
      await user.save();
    }
  } catch (error) {
    console.error(error);
  }
};
export const addProductInWarehouse2 = async (warehouse, warehouseId, orderItem) => {
  try {
    const user = await Warehouse.findById({ _id: warehouseId })
    if (!user) {
      return console.log("warehouse not found")
    }
    const sourceProductItem = user.productItems.find((pItem) => pItem.productId.toString() === warehouse._id.toString());
    if (sourceProductItem) {
      sourceProductItem.pQty += (orderItem.qty);
      sourceProductItem.pBAmount += (orderItem.totalPrice)
      sourceProductItem.pTaxRate = warehouse.GSTRate;
      sourceProductItem.pTotal += (orderItem.totalPrice)
      sourceProductItem.pRate = (orderItem.totalPrice / orderItem.qty) || 0;
      sourceProductItem.gstPercentage = warehouse.GSTRate
      sourceProductItem.currentStock += orderItem.qty
      sourceProductItem.price = orderItem.price;
      sourceProductItem.totalPrice += (orderItem.qty * orderItem.price);
      sourceProductItem.transferQty += orderItem.qty;
      user.markModified('productItems');
      await user.save();
    }
    console.log("(orderItem.pTotal/orderItem.pQty)+1", (orderItem.pTotal / orderItem.pQty), orderItem.pTotal, orderItem.pRate)
  } catch (error) {
    console.error(error);
  }
};
export const addProductInWarehouse4 = async (warehouse, warehouseId, orderItem, date) => {
  try {
    const dates = new Date(date);
    const startOfDay = new Date(dates);
    const endOfDay = new Date(dates);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const user = await Warehouse.findById({ _id: warehouseId })
    if (!user) {
      return console.log("warehouse not found")
    }
    const sourceProductItem = user.productItems.find((pItem) => pItem.productId.toString() === warehouse._id.toString());
    if (sourceProductItem) {
      sourceProductItem.gstPercentage = warehouse.GSTRate
      sourceProductItem.currentStock += orderItem.qty
      sourceProductItem.price = orderItem.price;
      sourceProductItem.totalPrice += (orderItem.qty * orderItem.price);
      sourceProductItem.transferQty += orderItem.qty;
      user.markModified('productItems');
      await user.save();
    }
    const stock = await Stock.findOne({ warehouseId: warehouseId.toString(), createdAt: { $gte: startOfDay, $lte: endOfDay } });
    if (!stock) {
      return console.log("warehouse not found")
    }
    const existingStock = stock.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
    if (existingStock) {
      existingStock.pQty += (orderItem.qty);
      existingStock.pTaxRate = warehouse.GSTRate;
      existingStock.pTotal += (orderItem.totalPrice)
      existingStock.pRate = (orderItem.pTotal / orderItem.pQty) || 0;
      stock.markModified('productItems');
      await stock.save();
    }
  } catch (error) {
    console.error(error);
  }
};
export const addProductInWarehouse3 = async (warehouse, warehouseId, orderItem, date) => {
  try {

    const dates = new Date(date);
    const startOfDay = new Date(dates);
    const endOfDay = new Date(dates);
    startOfDay.setUTCHours(0, 0, 0, 0);
    endOfDay.setUTCHours(23, 59, 59, 999);
    console.log("warehouse", warehouse, warehouseId)
    const user = await Warehouse.findById({ _id: warehouseId })
    if (!user) {
      return console.log("warehouse not found")
    }
    const sourceProductItem = user.productItems.find((pItem) => pItem.productId === warehouse._id.toString());
    if (sourceProductItem) {
      sourceProductItem.gstPercentage = warehouse.GSTRate
      sourceProductItem.currentStock += orderItem.qty
      sourceProductItem.price = orderItem.price;
      sourceProductItem.totalPrice += (orderItem.qty * orderItem.price);
      sourceProductItem.transferQty += orderItem.qty;
      user.markModified('productItems');
      await user.save();
    }
    const stock = await Stock.findOne({
      warehouseId: warehouseId.toString(),
      date: { $gte: startOfDay, $lte: endOfDay }
    });
    // const stock = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay, $lte: endOfDay } });
    if (!stock) {
      let productItems = {
        productId: warehouse._id.toString(),
        gstPercentage: warehouse.GSTRate,
        currentStock: warehouse.qty,
        price: warehouse.Purchase_Rate,
        totalPrice: (warehouse.qty * warehouse.Purchase_Rate),
        oQty: warehouse.Opening_Stock,
        oRate: warehouse.Purchase_Rate,
        oTaxRate: warehouse.GSTRate,
        oTotal: (warehouse.qty * warehouse.Purchase_Rate),
        pQty: orderItem.qty,
        pBAmount: orderItem.totalPrice,
        pTaxRate: warehouse.GSTRate,
        pTotal: orderItem.totalPrice,
        pRate: (orderItem.pTotal / orderItem.pQty) || 0,
        date: date
      }
      console.log("pRate i wanting", orderItem.pTotal, orderItem.pQty, (orderItem.pTotal / orderItem.pQty))
      let warehouses = {
        database: warehouse.database,
        warehouseId: warehouseId,
        closingStatus: "closing",
        productItems: productItems,
        date: date
      }
      const stock = await Stock.find({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay } });
      if (stock.length === 0) {
        console.log("warehouse not found")
      } else {
        for (let item of stock) {
          const existingStock = item.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          if (existingStock) {
            existingStock.gstPercentage = warehouse.GSTRate
            existingStock.currentStock += orderItem.qty
            existingStock.price = orderItem.price;
            existingStock.totalPrice += (orderItem.qty * orderItem.price);
            item.markModified('productItems');
            await item.save();
          }
        }
      }
      await Stock.create(warehouses)
    } else {
      const stock = await Stock.find({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay } });
      if (stock.length === 0) {
        console.log("warehouse not found")
      } else {
        for (let item of stock) {
          const existingStock = item.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          if (existingStock) {
            if (item.date.toDateString() === dates.toDateString()) {
              existingStock.pQty += (orderItem.qty);
              existingStock.pBAmount += (orderItem.totalPrice)
              existingStock.pTaxRate = warehouse.GSTRate;
              existingStock.pTotal += (orderItem.totalPrice)
              existingStock.gstPercentage = warehouse.GSTRate
              existingStock.currentStock += orderItem.qty
              existingStock.price = orderItem.price;
              existingStock.totalPrice += (orderItem.qty * orderItem.price);
              existingStock.pRate = (existingStock.totalPrice / (existingStock.pQty)) || 0;
              item.markModified('productItems');
              await item.save();

            } else {
              existingStock.gstPercentage = warehouse.GSTRate
              existingStock.currentStock += orderItem.qty
              existingStock.price = orderItem.price;
              existingStock.totalPrice += (orderItem.qty * orderItem.price);
              item.markModified('productItems');
              await item.save();
            }
          }
        }
        const existProductInStock = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay, $lte: endOfDay } });
        if (existProductInStock) {
          const existingProduct = existProductInStock.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          if (!existingProduct) {
            console.log("existingProduct2", orderItem)
            let productItems = {
              productId: warehouse._id.toString(),
              gstPercentage: warehouse.GSTRate,
              currentStock: warehouse.qty,
              price: warehouse.Purchase_Rate,
              totalPrice: (warehouse.qty * warehouse.Purchase_Rate),
              oQty: warehouse.Opening_Stock,
              oRate: warehouse.Purchase_Rate,
              oTaxRate: warehouse.GSTRate,
              oTotal: (warehouse.qty * warehouse.Purchase_Rate),
              pQty: orderItem.qty,
              pBAmount: orderItem.totalPrice,
              pTaxRate: warehouse.GSTRate,
              pTotal: orderItem.totalPrice,
              pRate: (orderItem.totalPrice / orderItem.qty) || 0,
              // pRate:((orderItem.price*orderItem.qty) / orderItem.qty) || 0,
              date: date
            }
            existProductInStock.productItems.push(productItems);
            await existProductInStock.save();
          }
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
};

export const addProductInWarehouse5 = async (warehouse, warehouseId, orderItem, date) => {
  try {
    console.log("warehousee", warehouse)
    console.log("orderItemssssssss", orderItem)
    const dates = new Date(date);
    const startOfDay = new Date(dates);
    const endOfDay = new Date(dates);
    startOfDay.setUTCHours(0, 0, 0, 0);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const user = await Warehouse.findById({ _id: warehouseId })
    if (!user) {
      return console.log("warehouse not found")
    }
    const sourceProductItem = user.productItems.find((pItem) => pItem.productId.toString() === warehouse._id.toString());
    console.log("sourceProductItem", sourceProductItem)
    console.log("orderItem", orderItem)
    if (sourceProductItem) {
      sourceProductItem.gstPercentage = warehouse.GSTRate
      sourceProductItem.currentStock -= orderItem.qty
      sourceProductItem.price = orderItem.price;
      sourceProductItem.totalPrice -= (orderItem.qty * orderItem.price);
      sourceProductItem.transferQty -= orderItem.qty;
      user.markModified('productItems');
      await user.save();
    }
    const stock = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay, $lte: endOfDay } });
    console.log("stocks", stock)
    if (!stock) {
      let productItems = {
        productId: warehouse._id.toString(),
        gstPercentage: warehouse.GSTRate,
        currentStock: warehouse.qty,
        price: warehouse.Purchase_Rate,
        totalPrice: (warehouse.qty * orderItem.price),
        oQty: warehouse.Opening_Stock,
        oRate: warehouse.Purchase_Rate,
        oTaxRate: warehouse.GSTRate,
        oTotal: (warehouse.qty * warehouse.Purchase_Rate),
        sQty: orderItem.qty,
        sRate: orderItem.price,
        sBAmount: orderItem.totalPrice,
        sTaxRate: warehouse.GSTRate,
        sTotal: orderItem.totalPrice,
        date: date
      }
      let warehouses = {
        database: warehouse.database,
        warehouseId: warehouseId,
        closingStatus: "closing",
        productItems: productItems,
        date: date
      }
      const stock = await Stock.find({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay } });
      if (stock.length === 0) {
        console.log("warehouse not found")
      } else {
        for (let item of stock) {
          const existingStock = item.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          if (existingStock) {
            existingStock.gstPercentage = warehouse.GSTRate
            existingStock.currentStock -= orderItem.qty
            existingStock.price = orderItem.price;
            existingStock.totalPrice -= (orderItem.qty * orderItem.price);
            item.markModified('productItems');
            await item.save();
          }
        }
      }
      await Stock.create(warehouses)
    } else {
      const stock = await Stock.find({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay } });
      console.log("elsestock", stock)
      if (stock.length === 0) {
        return console.log("warehouse not found")
      } else {
        for (let item of stock) {
          const existingStock = item.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          console.log("existingStockss", existingStock)
          if (existingStock) {
            if (item.date.toDateString() === dates.toDateString()) {
              existingStock.sQty += (orderItem.qty);
              existingStock.sRate = (orderItem.price);
              existingStock.sBAmount += (orderItem.totalPrice)
              existingStock.sTaxRate = warehouse.GSTRate;
              existingStock.sTotal += (orderItem.totalPrice)
              existingStock.gstPercentage = warehouse.GSTRate
              existingStock.currentStock -= orderItem.qty
              existingStock.price = orderItem.price;
              existingStock.totalPrice -= (orderItem.qty * orderItem.price);
              item.markModified('productItems');
              await item.save();
            } else {
              existingStock.gstPercentage = warehouse.GSTRate
              existingStock.currentStock -= orderItem.qty
              existingStock.price = orderItem.price;
              existingStock.totalPrice -= (orderItem.qty * orderItem.price);
              item.markModified('productItems');
              await item.save();
            }
          }
        }
        const existProductInStock = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay, $lte: endOfDay } });
        if (existProductInStock) {
          console.log("existProductInStock", existProductInStock)
          const existingProduct = existProductInStock.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          console.log("exisyingProduct", existingProduct)
          if (!existingProduct) {
            let productItems = {
              productId: warehouse._id.toString(),
              gstPercentage: warehouse.GSTRate,
              currentStock: warehouse.qty,
              price: warehouse.Purchase_Rate,
              totalPrice: (Number(warehouse.qty) || 0) * (Number(orderItem.price) || 0),
              oQty: warehouse.Opening_Stock,
              oRate: warehouse.Purchase_Rate,
              oTaxRate: warehouse.GSTRate,
              oTotal: (warehouse.qty * warehouse.Purchase_Rate),
              sQty: orderItem.qty,
              sRate: orderItem.price,
              sBAmount: orderItem.totalPrice,
              sTaxRate: warehouse.GSTRate,
              sTotal: orderItem.totalPrice,
              date: date
            }

            console.log("productItemssss", productItems)
            console.log("warehouse.qty", warehouse.qty)
            console.log("orderItem.price", orderItem.price)
            console.log("(warehouse.qty * orderItem.price)", (warehouse.qty * orderItem.price))
            existProductInStock.productItems.push(productItems);
            await existProductInStock.save();
          }
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
};
export const addProductInWarehouse6 = async (warehouse, warehouseId, orderItem, date) => {
  try {
    const dates = new Date(date);
    const startOfDay = new Date(dates);
    const endOfDay = new Date(dates);
    startOfDay.setUTCHours(0, 0, 0, 0);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const user = await Warehouse.findById({ _id: warehouseId })
    if (!user) {
      return console.log("warehouse not found")
    }
    const stock = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay, $lte: endOfDay } });
    if (!stock) {
      let productItems = {
        productId: warehouse._id.toString(),
        gstPercentage: warehouse.GSTRate,
        currentStock: warehouse.qty,
        pendingStock: orderItem.qty,
        pendingStockTotal: (orderItem.qty * orderItem.price),
        price: warehouse.Purchase_Rate,
        totalPrice: (warehouse.qty * warehouse.Purchase_Rate),
        oQty: warehouse.Opening_Stock,
        oRate: warehouse.Purchase_Rate,
        oTaxRate: warehouse.GSTRate,
        oTotal: (warehouse.qty * warehouse.Purchase_Rate),
        date: date
      }
      let warehouses = {
        database: warehouse.database,
        warehouseId: warehouseId,
        closingStatus: "closing",
        productItems: productItems,
        date: date
      }
      const stock = await Stock.find({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay } });
      if (stock.length === 0) {
        console.log("warehouse not found")
      } else {
        for (let item of stock) {
          const existingStock = item.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          if (existingStock) {
            existingStock.gstPercentage = warehouse.GSTRate
            existingStock.currentStock -= orderItem.qty
            existingStock.price = orderItem.price;
            existingStock.totalPrice -= (orderItem.qty * orderItem.price);
            item.markModified('productItems');
            await item.save();
          }
        }
      }
      await Stock.create(warehouses)
    } else {
      const stock = await Stock.find({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay } });
      if (stock.length === 0) {
        return console.log("warehouse not found")
      } else {
        for (let item of stock) {
          const existingStock = item.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          if (existingStock) {
            if (item.date.toDateString() === dates.toDateString()) {
              existingStock.gstPercentage = warehouse.GSTRate
              existingStock.currentStock -= orderItem.qty
              existingStock.pendingStock += orderItem.qty
              existingStock.pendingStockTotal += (orderItem.qty * orderItem.price)
              existingStock.price = orderItem.price;
              existingStock.totalPrice -= (orderItem.qty * orderItem.price);
              item.markModified('productItems');
              await item.save();
            } else {
              existingStock.gstPercentage = warehouse.GSTRate
              existingStock.currentStock -= orderItem.qty
              existingStock.price = orderItem.price;
              existingStock.totalPrice -= (orderItem.qty * orderItem.price);
              item.markModified('productItems');
              await item.save();
            }
          }
        }
        const existProductInStock = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay, $lte: endOfDay } });
        if (existProductInStock) {
          const existingProduct = existProductInStock.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          if (!existingProduct) {
            let productItems = {
              productId: warehouse._id.toString(),
              gstPercentage: warehouse.GSTRate,
              currentStock: warehouse.qty,
              pendingStock: orderItem.qty,
              pendingStockTotal: (orderItem.qty * orderItem.price),
              price: warehouse.Purchase_Rate,
              totalPrice: (warehouse.qty * warehouse.Purchase_Rate),
              oQty: warehouse.Opening_Stock,
              oRate: warehouse.Purchase_Rate,
              oTaxRate: warehouse.GSTRate,
              oTotal: (warehouse.qty * warehouse.Purchase_Rate),
              date: date
            }
            existProductInStock.productItems.push(productItems);
            await existProductInStock.save();
          }
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
};
export const addProductInWarehouse7 = async (warehouse, warehouseId, orderItem, date, orderDate) => {
  try {
    const dates = new Date(date);
    const startOfDay = new Date(dates);
    const endOfDay = new Date(dates);
    startOfDay.setUTCHours(0, 0, 0, 0);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const user = await Warehouse.findById({ _id: warehouseId })
    if (!user) {
      return console.log("warehouse not found")
    }
    const stock = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay, $lte: endOfDay } });
    if (!stock) {
      let productItems = {
        productId: warehouse._id.toString(),
        gstPercentage: warehouse.GSTRate,
        currentStock: warehouse.qty,
        price: warehouse.Purchase_Rate,
        totalPrice: (warehouse.qty * warehouse.Purchase_Rate),
        oQty: warehouse.Opening_Stock,
        oRate: warehouse.Purchase_Rate,
        oTaxRate: warehouse.GSTRate,
        oTotal: (warehouse.qty * warehouse.Purchase_Rate),
        sQty: orderItem.qty,
        sRate: orderItem.price,
        sBAmount: orderItem.totalPrice,
        sTaxRate: warehouse.GSTRate,
        sTotal: orderItem.totalPrice,
        date: date
      }
      let warehouses = {
        database: warehouse.database,
        warehouseId: warehouseId,
        closingStatus: "closing",
        productItems: productItems,
        date: date
      }
      await Stock.create(warehouses)
    } else {
      const existingStock = stock.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
      if (existingStock) {
        if (existingStock.date.toDateString() === dates.toDateString()) {
          existingStock.sQty += (orderItem.qty);
          existingStock.sRate = (orderItem.price);
          existingStock.sBAmount += (orderItem.totalPrice)
          existingStock.sTaxRate = warehouse.GSTRate;
          existingStock.sTotal += (orderItem.totalPrice)
          stock.markModified('productItems');
          await stock.save();
        }
      } else {
        let productItems = {
          productId: warehouse._id.toString(),
          gstPercentage: warehouse.GSTRate,
          currentStock: warehouse.qty,
          price: warehouse.Purchase_Rate,
          totalPrice: (warehouse.qty * warehouse.Purchase_Rate),
          oQty: warehouse.Opening_Stock,
          oRate: warehouse.Purchase_Rate,
          oTaxRate: warehouse.GSTRate,
          oTotal: (warehouse.qty * warehouse.Purchase_Rate),
          sQty: orderItem.qty,
          sRate: orderItem.price,
          sBAmount: orderItem.totalPrice,
          sTaxRate: warehouse.GSTRate,
          sTotal: orderItem.totalPrice,
          date: date
        }
        stock.productItems.push(productItems);
        await stock.save();
      }
    }
    await addProductInWarehouse8(warehouse, warehouseId, orderItem, orderDate)
  } catch (err) {
    console.error(err);
  }
};
export const addProductInWarehouse8 = async (warehouse, warehouseId, orderItem, date) => {
  try {
    const dates = new Date(date);
    const startOfDay = new Date(dates);
    const endOfDay = new Date(dates);
    startOfDay.setUTCHours(0, 0, 0, 0);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const user = await Warehouse.findById({ _id: warehouseId })
    if (!user) {
      return console.log("warehouse not found")
    }
    const stock = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay, $lte: endOfDay } });
    if (stock) {
      const existingStock = stock.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
      if (existingStock) {
        existingStock.pendingStock -= (orderItem.qty);
        existingStock.pendingStockTotal -= (orderItem.qty * warehouse.Purchase_Rate)
        stock.markModified('productItems');
        await stock.save();
      }
    }
  } catch (err) {
    console.error(err);
  }
};
export const addProductInWarehouse9 = async (warehouse, warehouseId, orderItem, date1) => {
  try {
    const datess = new Date(date1);
    const startOfDay1 = new Date(datess);
    const endOfDay1 = new Date(datess);
    startOfDay1.setUTCHours(0, 0, 0, 0);
    endOfDay1.setUTCHours(23, 59, 59, 999);
    const date = new Date();
    const dates = new Date(date);
    const startOfDay = new Date(dates);
    const endOfDay = new Date(dates);
    startOfDay.setUTCHours(0, 0, 0, 0);
    endOfDay.setUTCHours(23, 59, 59, 999);
    const user = await Warehouse.findById({ _id: warehouseId })
    if (!user) {
      return console.log("warehouse not found")
    }
    const stock = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay, $lte: endOfDay } });
    if (!stock) {
      let productItems = {
        productId: warehouse._id.toString(),
        gstPercentage: warehouse.GSTRate,
        currentStock: warehouse.qty,
        price: warehouse.Purchase_Rate,
        totalPrice: (warehouse.qty * warehouse.Purchase_Rate),
        oQty: warehouse.Opening_Stock,
        oRate: warehouse.Purchase_Rate,
        oTaxRate: warehouse.GSTRate,
        oTotal: (warehouse.qty * warehouse.Purchase_Rate),
        rQty: orderItem.qty,
        date: date
      }
      let warehouses = {
        database: warehouse.database,
        warehouseId: warehouseId,
        closingStatus: "closing",
        productItems: productItems,
        date: date
      }
      const stock = await Stock.find({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay } });
      if (stock.length === 0) {
        console.log("warehouse not found")
      } else {
        for (let item of stock) {
          const existingStock = item.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          if (existingStock) {
            existingStock.gstPercentage = warehouse.GSTRate
            existingStock.currentStock += orderItem.qty
            existingStock.price = orderItem.price;
            existingStock.totalPrice += (orderItem.qty * orderItem.price);
            item.markModified('productItems');
            await item.save();
          }
          // return qty
          const stock1 = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay1, $lte: endOfDay1 } });
          if (stock1) {
            const existingStock1 = stock.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
            if (existingStock1) {
              existingStock.pendingStock -= orderItem.qty;
              existingStock.pendingStockTotal -= (orderItem.qty * warehouse.Purchase_Rate)
              item.markModified('productItems');
              await item.save();
            }
          }
        }
      }
      await Stock.create(warehouses)
    } else {
      const stock = await Stock.find({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay } });
      if (stock.length === 0) {
        console.log("warehouse not found")
      } else {
        for (let item of stock) {
          const existingStock = item.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          if (existingStock) {
            if (item.date.toDateString() === dates.toDateString()) {
              existingStock.rQty += (orderItem.qty);
              existingStock.gstPercentage = warehouse.GSTRate
              existingStock.currentStock += orderItem.qty
              existingStock.price = orderItem.price;
              existingStock.totalPrice += (orderItem.qty * orderItem.price);
              item.markModified('productItems');
              await item.save();
            } else {
              existingStock.gstPercentage = warehouse.GSTRate
              existingStock.currentStock += orderItem.qty
              existingStock.price = orderItem.price;
              existingStock.totalPrice += (orderItem.qty * orderItem.price);
              item.markModified('productItems');
              await item.save();
            }
          }
          // return qty
          const stock1 = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay1, $lte: endOfDay1 } });
          if (stock1) {
            const existingStock1 = stock1.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
            if (existingStock1) {
              existingStock.pendingStock -= orderItem.qty;
              existingStock.pendingStockTotal -= (orderItem.qty * warehouse.Purchase_Rate)
              item.markModified('productItems');
              await item.save();
            }
          }
        }
        const existProductInStock = await Stock.findOne({ warehouseId: warehouseId.toString(), date: { $gte: startOfDay, $lte: endOfDay } });
        if (existProductInStock) {
          const existingProduct = existProductInStock.productItems.find((item) => item.productId.toString() === warehouse._id.toString())
          if (!existingProduct) {
            let productItems = {
              productId: warehouse._id.toString(),
              gstPercentage: warehouse.GSTRate,
              currentStock: warehouse.qty,
              price: warehouse.Purchase_Rate,
              totalPrice: (warehouse.qty * warehouse.Purchase_Rate),
              oQty: warehouse.Opening_Stock,
              oRate: warehouse.Purchase_Rate,
              oTaxRate: warehouse.GSTRate,
              oTotal: (warehouse.qty * warehouse.Purchase_Rate),
              rQty: orderItem.qty,
              date: date
            }
            existProductInStock.productItems.push(productItems);
            await existProductInStock.save();
          }
        }
      }
    }
  } catch (err) {
    console.error(err);
  }
};

// HSN SALES SUMMARY REPORT

export const HSNWiseSalesReport = async (req, res, next) => {
  try {
    const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
    const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
    const targetQuery = { database: req.params.database, status: "completed" };
    if (startDate && endDate) {
      targetQuery.createdAt = { $gte: startDate, $lte: endDate };
    }
    let orders = [];
    const salesOrder = await CreateOrder.find(targetQuery).populate({ path: "orderItems.productId", model: "product" });
    if (salesOrder.length === 0) {
      return res.status(404).json({ message: "Not Found", status: false });
    }
    for (let order of salesOrder) {
      orders = orders.concat(order.orderItems);
    }
    const uniqueOrdersMap = new Map();
    for (let orderItem of orders) {
      const key = orderItem.productId.HSN_Code;
      if (uniqueOrdersMap.has(key)) {
        const existingOrder = uniqueOrdersMap.get(key);
        existingOrder.taxableAmount += orderItem.taxableAmount;
        existingOrder.cgstRate += orderItem.cgstRate;
        existingOrder.qty += orderItem.qty;
        existingOrder.sgstRate += orderItem.sgstRate;
        existingOrder.igstRate += orderItem.igstRate;
        existingOrder.grandTotal += orderItem.grandTotal;
        existingOrder.gstPercentage = orderItem.gstPercentage;
      } else {
        const newOrder = {
          // productId: orderItem.productId,
          primaryUnit: orderItem.productId.primaryUnit,
          secondaryUnit: orderItem.productId.secondaryUnit,
          HSN_Code: orderItem.productId.HSN_Code,
          Product_Desc: orderItem.productId.Product_Desc,
          unitType: orderItem.unitType,
          qty: orderItem.qty,
          grandTotal: orderItem.grandTotal,
          gstPercentage: orderItem.gstPercentage,
          taxableAmount: orderItem.taxableAmount,
          igstRate: orderItem.igstRate,
          cgstRate: orderItem.cgstRate,
          sgstRate: orderItem.sgstRate,
        };
        uniqueOrdersMap.set(key, newOrder);
      }
    }
    const uniqueOrders = Array.from(uniqueOrdersMap.values());
    return res.status(200).json({ HSNSales: uniqueOrders, status: true });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error", status: false });
  }
};
export const HSNWisePurchaseReport = async (req, res, next) => {
  try {
    const startDate = req.body.startDate ? new Date(req.body.startDate) : null;
    const endDate = req.body.endDate ? new Date(req.body.endDate) : null;
    const targetQuery = { database: req.params.database, status: "completed" };
    if (startDate && endDate) {
      targetQuery.createdAt = { $gte: startDate, $lte: endDate };
    }
    let orders = [];
    const salesOrder = await PurchaseOrder.find(targetQuery).populate({ path: "orderItems.productId", model: "product" });
    if (salesOrder.length === 0) {
      return res.status(404).json({ message: "Not Found", status: false });
    }
    for (let order of salesOrder) {
      orders = orders.concat(order.orderItems);
    }
    const uniqueOrdersMap = new Map();
    for (let orderItem of orders) {
      const key = orderItem.productId.HSN_Code;
      if (uniqueOrdersMap.has(key)) {
        const existingOrder = uniqueOrdersMap.get(key);
        existingOrder.taxableAmount += orderItem?.taxableAmount || 0;
        existingOrder.cgstRate += orderItem.cgstRate;
        existingOrder.qty += orderItem.qty;
        existingOrder.sgstRate += orderItem.sgstRate;
        existingOrder.igstRate += orderItem.igstRate;
        existingOrder.grandTotal += orderItem.grandTotal;
        existingOrder.gstPercentage = orderItem.gstPercentage;
      } else {
        const newOrder = {
          // productId: orderItem.productId,
          primaryUnit: orderItem.productId.primaryUnit,
          secondaryUnit: orderItem.productId.secondaryUnit,
          HSN_Code: orderItem.productId.HSN_Code,
          Product_Desc: orderItem.productId.Product_Desc,
          unitType: orderItem.unitType,
          qty: orderItem.qty,
          grandTotal: orderItem.grandTotal,
          gstPercentage: orderItem.gstPercentage,
          taxableAmount: orderItem.taxableAmount,
          igstRate: orderItem.igstRate,
          cgstRate: orderItem.cgstRate,
          sgstRate: orderItem.sgstRate,
        };
        uniqueOrdersMap.set(key, newOrder);
      }
    }
    const uniqueOrders = Array.from(uniqueOrdersMap.values());
    return res.status(200).json({ HSNPurchase: uniqueOrders, status: true });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ error: "Internal Server Error", status: false });
  }
};

// Sales Price
export const UpdateProductSalesRateMultiple = async (req, res, next) => {
  try {
    for (let item of req.body.Products) {
      const existingProduct = await Product.findById(item.id);
      if (!existingProduct) {
        continue
        // return res.status(404).json({ error: "Product Not Found", status: false });
      } else {
        existingProduct.SalesRate = item.SalesRate;
        existingProduct.Product_MRP = item.Product_MRP;
        existingProduct.ProfitPercentage = item.ProfitPercentage;
        await existingProduct.save()
      }
    }
    return res.status(200).json({ message: "Product Updated Successfully", status: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error", status: false });
  }
};
export const UpdateProductSalesRate = async (req, res, next) => {
  try {
    const productId = req.params.id;
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return res.status(404).json({ error: "Product Not Found", status: false });
    } else {
      existingProduct.SalesRate = req.body.SalesRate;
      existingProduct.Product_MRP = req.body.Product_MRP;
      existingProduct.ProfitPercentage = item.ProfitPercentage;
      existingProduct.save()
      return res.status(200).json({ message: "Product Updated Successfully", status: true });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal Server Error", status: false });
  }
};