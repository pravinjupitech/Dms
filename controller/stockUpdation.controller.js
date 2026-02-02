import moment from "moment"
import mongoose from "mongoose";
import { StockUpdation } from "../model/stockUpdation.model.js";
import { User } from "../model/user.model.js";
import { Stock } from "../model/stock.js";
import { CreateOrder } from "../model/createOrder.model.js";
import { Warehouse } from "../model/warehouse.model.js";
import { Product } from "../model/product.model.js";
import { Customer } from "../model/customer.model.js";
import { ClosingStock } from "../model/closingStock.model.js";
import { warehouseNo } from "../service/invoice.js";
import { PurchaseOrder } from "../model/purchaseOrder.model.js";
import { RawProduct } from "../model/rawProduct.model.js";
import { otpVerify } from "./warehouse.controller.js";
import { Order } from "../model/order.model.js";
import { Ledger } from "../model/ledger.model.js";

export const viewInWardStockToWarehouse = async (req, res, next) => {
    try {
        const stock = await StockUpdation.find({ warehouseToId: req.params.id, transferStatus: "InProcess" }).populate({ path: 'productItems.productId', model: 'product' }).populate({ path: "warehouseFromId", model: "warehouse" }).populate({ path: "warehouseToId", model: "warehouse" }).exec();
        if (!stock || stock.length === 0) {
            return res.status(404).json({ message: "No warehouse found", status: false });
        }
        return res.status(200).json({ Warehouse: stock, status: true })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err, status: false });
    }
};
export const viewOutWardStockToWarehouse = async (req, res, next) => {
    try {
        const stock = await StockUpdation.find({ warehouseFromId: req.params.id, transferStatus: "InProcess" }).populate({ path: 'productItems.productId', model: 'product' }).populate({ path: "warehouseToId", model: "warehouse" }).populate({ path: "warehouseFromId", model: "warehouse" }).exec();
        if (!stock || stock.length === 0) {
            return res.status(404).json({ message: "No warehouse found", status: false });
        }
        return res.status(200).json({ Warehouse: stock, status: true })
    } catch (err) {
        console.log(err);
        return res.status(500).json({ error: err, status: false });
    }
};

// export const stockTransferToWarehouse = async (req, res) => {
//     try {
//         const warehousefrom = await Warehouse.findOne({ _id: req.body.warehouseFromId });
//         if (!warehousefrom) {
//             return res.status(400).json({ message: "Warehouse From Not Found", status: false });
//         }

//         const warehouseno = await warehouseNo(warehousefrom.database);
//         warehousefrom.warehouseNo = warehousefrom.id + warehouseno;

//         const { warehouseToId, warehouseFromId, stockTransferDate, productItems, grandTotal, transferStatus, created_by, InwardStatus, OutwardStatus } = req.body;

//         for (const item of productItems) {
//             const sourceProduct = await Warehouse.findOne({
//                 _id: warehouseFromId,
//                 'productItems.productId': item.productId,
//             });
//             const sourceRawProduct = await Warehouse.findOne({
//                 _id: warehouseFromId,
//                 'productItems.rawProductId': item.productId
//             });

//             if (sourceProduct || sourceRawProduct) {
//                 const sourceProductItem = sourceProduct?.productItems?.find(
//                     (pItem) => pItem.productId && pItem.productId.toString() === item.productId.toString());

//                 const sourceRawProductItem = sourceRawProduct?.productItems?.find(
//                     (pItem) => pItem.rawProductId && pItem.rawProductId.toString() === item.productId.toString());

//                 if (sourceProductItem) {
//                     sourceProductItem.currentStock -= item.transferQty;
//                     sourceProductItem.pendingStock += item.transferQty;
//                     sourceProductItem.totalPrice -= item.totalPrice;
//                     sourceProduct.markModified('productItems');
//                     await sourceProduct.save();
//                 } else if (sourceRawProductItem) {
//                     sourceRawProductItem.price = item.price;
//                     sourceRawProductItem.pendingStock += item.transferQty;
//                     sourceRawProductItem.markModified("productItems");
//                     await sourceRawProduct.save();
//                 } else {
//                     return res.status(400).json({ error: 'Insufficient quantity in the source warehouse or product not found' });
//                 }
//             } else {
//                 return res.status(400).json({ error: 'Product not found in the source warehouse' });
//             }
//         }

//         const stockTransfer = new StockUpdation({
//             created_by,
//             warehouseToId,
//             warehouseFromId,
//             stockTransferDate,
//             productItems,
//             grandTotal,
//             transferStatus,
//             InwardStatus,
//             OutwardStatus,
//             database: warehousefrom.database,
//             warehouseNo: warehousefrom.warehouseNo,
//         });

//         await stockTransfer.save();
//         await warehousefrom.save();

//         return res.status(201).json({ message: 'Stock transfer successful', status: true });
//     } catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Internal Server Error', status: false });
//     }
// };

// export const stockTransferToWarehouse = async (req, res) => {
//     try {
//         const {
//             created_by,
//             warehouseFromId,
//             warehouseToId,
//             stockTransferDate,
//             productItems,
//             grandTotal,
//             transferStatus,
//             InwardStatus,
//             OutwardStatus
//         } = req.body;

//         const warehouseFrom = await Warehouse.findById(warehouseFromId);
//         if (!warehouseFrom) {
//             return res.status(400).json({
//                 message: "Warehouse From Not Found",
//                 status: false
//             });
//         }

//         const warehouseTo = await Warehouse.findById(warehouseToId);
//         if (!warehouseTo) {
//             return res.status(400).json({
//                 message: "Warehouse To Not Found",
//                 status: false
//             });
//         }

//         const warehouseno = await warehouseNo(warehouseFrom.database);
//         warehouseFrom.warehouseNo = warehouseFrom.id + warehouseno;

//         for (const item of productItems) {

//             const fromProduct = warehouseFrom.productItems.find(
//                 (p) => p.productId?.toString() === item.fromProductId?.toString()
//             );

//             if (!fromProduct) {
//                 return res.status(400).json({
//                     error: "Product not found in source warehouse"
//                 });
//             }

//             if (fromProduct.currentStock < item.transferQty) {
//                 return res.status(400).json({
//                     error: "Insufficient stock"
//                 });
//             }
//             const product = await Product.findById(item?.fromProductId)
//             if (product) {
//                 product.qty -= item.transferQty;
//                 await product.save()
//             }
//             fromProduct.currentStock -= item.transferQty;
//             fromProduct.pendingStock += item.transferQty;
//             fromProduct.totalPrice -= item.totalPrice;

//             let toProduct = warehouseTo.productItems.find(
//                 (p) => p.productId?.toString() === item.toProductId?.toString()
//             );

//             if (toProduct) {
//                 const product = await Product.findById(item?.toProductId)
//                 if (product) {
//                     product.qty += item.transferQty;
//                     await product.save()
//                 }
//                 toProduct.currentStock += item.transferQty;
//                 toProduct.totalPrice += item.totalPrice;
//                 toProduct.price = item.price;
//             } else {
//                 warehouseTo.productItems.push({
//                     productId: item.toProductId,
//                     currentStock: item.transferQty,
//                     pendingStock: 0,
//                     price: item.price,
//                     totalPrice: item.totalPrice,
//                     primaryUnit: item.primaryUnit
//                 });
//             }
//         }

//         warehouseFrom.markModified("productItems");
//         warehouseTo.markModified("productItems");

//         await warehouseFrom.save();
//         await warehouseTo.save();

//         const stockTransfer = new StockUpdation({
//             created_by,
//             warehouseFromId,
//             warehouseToId,
//             stockTransferDate,
//             productItems,
//             grandTotal,
//             transferStatus,
//             InwardStatus,
//             OutwardStatus,
//             database: warehouseFrom.database,
//             warehouseNo: warehouseFrom.warehouseNo
//         });

//         await stockTransfer.save();

//         return res.status(201).json({
//             message: "Stock transferred successfully",
//             status: true
//         });

//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             error: "Internal Server Error",
//             status: false
//         });
//     }
// };

export const stockTransferToWarehouse = async (req, res) => {
  try {
    const {
      created_by,
      warehouseFromId,
      warehouseToId,
      stockTransferDate,
      productItems = [],
      grandTotal,
      transferStatus,
      InwardStatus,
      OutwardStatus
    } = req.body;

    if (!warehouseFromId || !warehouseToId || !productItems.length) {
      return res.status(400).json({
        message: "Missing required fields",
        status: false
      });
    }

    const [warehouseFrom, warehouseTo] = await Promise.all([
      Warehouse.findById(warehouseFromId),
      Warehouse.findById(warehouseToId)
    ]);

    if (!warehouseFrom) {
      return res.status(400).json({
        message: "Warehouse From Not Found",
        status: false
      });
    }

    if (!warehouseTo) {
      return res.status(400).json({
        message: "Warehouse To Not Found",
        status: false
      });
    }

    const warehouseno = await warehouseNo(warehouseFrom.database);
    warehouseFrom.warehouseNo = `${warehouseFrom.id}${warehouseno}`;

    for (const item of productItems) {
      const {
        fromProductId,
        toProductId,
        transferQty,
        totalPrice,
        price,
        primaryUnit
      } = item;

      const fromProduct = warehouseFrom.productItems.find(
        p => p.productId?.toString() === fromProductId?.toString()
      );

      if (!fromProduct) {
        return res.status(400).json({
          error: "Product not found in source warehouse"
        });
      }

      if (fromProduct.currentStock < transferQty) {
        return res.status(400).json({
          error: "Insufficient stock"
        });
      }

      /** Update main product (FROM) */
      const fromMainProduct = await Product.findById(fromProductId);
      if (fromMainProduct) {
        fromMainProduct.qty -= transferQty;
        await fromMainProduct.save();
      }

      /** Update source warehouse stock */
      fromProduct.currentStock -= transferQty;
      fromProduct.pendingStock += transferQty;
      fromProduct.totalPrice -= totalPrice;

      /** Handle destination warehouse product */
      let toProduct = warehouseTo.productItems.find(
        p => p.productId?.toString() === toProductId?.toString()
      );

      /** Update main product (TO) */
      const toMainProduct = await Product.findById(toProductId);
      if (toMainProduct) {
        toMainProduct.qty += transferQty;
        await toMainProduct.save();
      }

      if (toProduct) {
        toProduct.currentStock += transferQty;
        toProduct.totalPrice += totalPrice;
        toProduct.price = price;
      } else {
        warehouseTo.productItems.push({
          productId: toProductId,
          currentStock: transferQty,
          pendingStock: 0,
          price,
          totalPrice,
          primaryUnit
        });
      }
    }

    warehouseFrom.markModified("productItems");
    warehouseTo.markModified("productItems");

    await Promise.all([
      warehouseFrom.save(),
      warehouseTo.save()
    ]);

    const stockTransfer = new StockUpdation({
      created_by,
      warehouseFromId,
      warehouseToId,
      stockTransferDate,
      productItems,
      grandTotal,
      transferStatus,
      InwardStatus,
      OutwardStatus,
      database: warehouseFrom.database,
      warehouseNo: warehouseFrom.warehouseNo
    });

    await stockTransfer.save();

    return res.status(201).json({
      message: "Stock transferred successfully",
      status: true
    });

  } catch (error) {
    console.error("Stock Transfer Error:", error);
    return res.status(500).json({
      error: "Internal Server Error",
      status: false
    });
  }
};

export const viewWarehouseStock = async (req, res) => {
    try {
        const database = req.params.database;
        const warehouse = await StockUpdation.find({ database: database }).sort({ sortorder: -1 }).populate({ path: "productItems.productId", model: "product" }).populate({ path: "warehouseToId", model: "warehouse" }).populate({ path: "warehouseFromId", model: "warehouse" });
        if (warehouse.length > 0) {
            return res.status(200).json({ Warehouse: warehouse, status: true });
        } else {
            return res.status(404).json({ message: 'Warehouse not found', status: false });
        }
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error', status: false });
    }
}
export const updateWarehousetoWarehouse = async (req, res, next) => {
    try {
        const factoryId = req.params.id
        const existingFactory = await StockUpdation.findById({ _id: factoryId });
        if (!existingFactory) {
            return res.status(404).json({ message: 'Warehouse not found', status: false });
        }
        await StockUpdation.findByIdAndUpdate(factoryId, req.body, { new: true })
        for (const item of existingFactory.productItems) {
            const sourceRawProduct = await Warehouse.findOne({
                _id: existingFactory.warehouseFromId,
                "productItems.rawProductId": item.productId,
            });
            const sourceMainProduct = await Warehouse.findOne({
                _id: existingFactory.warehouseFromId,
                "productItems.productId": item.productId,
            });
            const sourceProduct = sourceMainProduct || sourceRawProduct;
            if (sourceProduct) {
                const sourceRawProductItem = sourceProduct.productItems.find(
                    (pItem) => pItem.rawProductId === item.productId
                );
                const sourceMainProductItem = sourceProduct.productItems.find(
                    (pItem) => pItem.productId === item.productId
                );
                const sourceProductItem = sourceMainProductItem || sourceRawProductItem;
                if (sourceProductItem) {
                    sourceProductItem.pendingStock -= (item.transferQty);
                    sourceProduct.markModified('productItems');
                    await sourceProduct.save();
                    const destinationMainProduct = await Warehouse.findOne({
                        _id: existingFactory.warehouseToId,
                        "productItems.productId": item.destinationProductId,
                    });
                    const destinationRawProduct = await Warehouse.findOne({
                        _id: existingFactory.warehouseToId,
                        "productItems.rawProductId": item.destinationProductId,
                    });
                    const destinationProduct =
                        destinationMainProduct || destinationRawProduct;
                    if (destinationProduct) {
                        const destinationMainProductItem =
                            destinationProduct.productItems.find(
                                (pItem) => pItem.productId === item.destinationProductId
                            );
                        const destinationRawProductItem =
                            destinationProduct.productItems.find(
                                (pItem) => pItem.rawProductId === item.destinationProductId
                            );
                        const destinationProductItem =
                            destinationMainProductItem || destinationRawProductItem;
                        if (destinationProductItem) {
                            const modelName = destinationProductItem.rawProductId
                                ? RawProduct
                                : Product;
                            const product = await modelName.findOne({
                                _id: item.destinationProductId,
                            });

                            if (product) {
                                product.qty += item.transferQty;
                                await product.save();
                            }
                            destinationProductItem.price = item.price;
                            destinationProductItem.currentStock += (item.transferQty);
                            destinationProductItem.totalPrice += item.totalPrice;
                            await destinationProduct.save();
                        }
                    } else {
                        item.currentStock = item.transferQty
                        await Warehouse.updateOne({ _id: existingFactory.warehouseToId },
                            { $push: { productItems: item }, $set: { stockTransferDate: existingFactory.stockTransferDate, transferStatus: existingFactory.transferStatus, grandTotal: existingFactory.grandTotal, warehouseFromId: existingFactory.warehouseFromId } }, { upsert: true });
                    }
                }
            }
        }
        return res.status(200).json({ message: "status updated successfull!", status: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal Server Error', status: false });
    }
};
// doubt
export const viewProductInWarehouse = async (req, res, next) => {
    try {
        const warehouse = await Warehouse.findById(req.params.id).populate({ path: "productItems.productId", model: "product" });
        if (!warehouse) {
            return res.status(400).json({ message: "Not Found", status: true });
        }
        const productDetails = warehouse.productItems.map(item => {
            return {
                productId: item.productId._id,
                created_by: item.productId.created_by,
                Product_Title: item.productId.Product_Title,
                Size: item.productId.Size,
                discount: item.productId.discount,
                HSN_Code: item.productId.HSN_Code,
                'GST Rate': item.productId['GST Rate'],
                Product_Desc: item.productId.Product_Desc,
                Product_MRP: item.productId.Product_MRP,
                MIN_stockalert: item.productId.MIN_stockalert,
                warehouse: item.productId.warehouse,
                SubCategory: item.productId.SubCategory,
                Unit: item.productId.Unit,
                Warehouse_name: item.productId.Warehouse_name,
                createdAt: item.productId.createdAt,
                updatedAt: item.productId.updatedAt,
                unitType: item.unitType,
                transferQty: item.transferQty,
                price: item.price,
                totalPrice: item.totalPrice,
                _id: item._id
            };
        });
        return res.status(200).json(productDetails);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
}
//-------------------------------------------------------------
export const saveDamageItem1 = async (req, res, next) => {
    try {
        const warehouse = await Warehouse.findOne({ _id: req.body.warehouse });
        if (warehouse) {
            const newSubCategory = {
                productId: req.body.productId,
                unitType: req.body.unitType,
                transferQty: req.body.transferQty,
                Size: req.body.Size,
                currentStock: req.body.currentStock,
                price: req.body.price,
                totalPrice: req.body.totalPrice,
                demagePercentage: req.body.demagePercentage,
                reason: req.body.reason,
                typeStatus: req.body.typeStatus
            };

            warehouse.typeStatus = req.body.typeStatus;
            warehouse.damageItem.push(newSubCategory);
            const savedDamageItem = await warehouse.save();
            return res.status(200).json({ message: "damageItem saved successfully", status: true, warehouse: savedDamageItem });
        } else {
            return res.status(404).json({ message: "damageItem not found", status: false });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error, status: false });
    }
};
export const saveDamageItem = async (req, res, next) => {
    try {
        const warehouse = await Warehouse.findOne({ _id: req.body.warehouse });
        if (!warehouse) {
            return res.status(404).json({ message: "Warehouse not found", status: false });
        }
        const existingProduct = warehouse.productItems.find(item => item.productId.toString() === req.body.productId.toString());

        if (existingProduct) {
            existingProduct.damageItem = {
                productId: req.body.productId,
                unitType: req.body.unitType,
                transferQty: req.body.transferQty,
                size: req.body.size,
                currentStock: req.body.currentStock,
                price: req.body.price,
                totalPrice: req.body.totalPrice,
                damagePercentage: req.body.damagePercentage,
                reason: req.body.reason,
                typeStatus: req.body.typeStatus
            };
            existingProduct.currentStock = req.body.currentStock
            warehouse.typeStatus = req.body.typeStatus;
            const savedWarehouse = await warehouse.save();
            return res.status(200).json({ message: "Damage item saved successfully", status: true, warehouse: savedWarehouse });
        } else {
            return res.status(404).json({ message: "product not found in warehouse", status: false })
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error", status: false });
    }
};

export const saveShortItem = async (req, res, next) => {
    try {
        const warehouse = await Warehouse.findOne({ _id: req.body.warehouse });
        if (!warehouse) {
            return res.status(404).json({ message: "Warehouse not found", status: false });
        }
        const existingProduct = warehouse.productItems.find(item => item.productId.toString() === req.body.productId.toString());

        if (existingProduct) {
            existingProduct.shortItem = {
                productId: req.body.productId,
                date: req.body.date,
                shortQty: req.body.qty,
                dateOfShortage: req.body.dateOfShortage,
                price: req.body.price,
                totalPrice: req.body.totalPrice,
                reason: req.body.reason,
                typeStatus: req.body.typeStatus
            };
            // existingProduct.currentStock = req.body.currentStock
            // warehouse.typeStatus = req.body.typeStatus;
            const savedWarehouse = await warehouse.save();
            return res.status(200).json({ message: "short item saved successfully", status: true, warehouse: savedWarehouse });
        } else {
            return res.status(404).json({ message: "product not found in warehouse", status: false })
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error", status: false });
    }
};
export const updateDamageItem = async (req, res, next) => {
    try {
        const warehouse = await Warehouse.findOne({ _id: req.body.warehouse });
        if (!warehouse) {
            return res.status(404).json({ message: "Warehouse not found", status: false });
        }
        const existingProduct = warehouse.productItems.find(item => item.productId === req.body.productId);
        if (!existingProduct) {
            return res.status(404).json({ message: "Product not found", status: false });
        }
        existingProduct.damageItem = {
            productId: req.body.productId || existingProduct.damageItem.productId,
            transferQty: req.body.transferQty || existingProduct.damageItem.transferQty,
            currentStock: req.body.currentStock || existingProduct.damageItem.currentStock,
            price: req.body.price || existingProduct.damageItem.price,
            totalPrice: req.body.totalPrice || existingProduct.damageItem.totalPrice,
            damagePercentage: req.body.damagePercentage || existingProduct.damageItem.damagePercentage,
            reason: req.body.reason || existingProduct.damageItem.reason,
            typeStatus: req.body.typeStatus || existingProduct.damageItem.typeStatus,
        };
        existingProduct.currentStock = req.body.currentStock || existingProduct.currentStock
        warehouse.typeStatus = req.body.typeStatus;
        const savedWarehouse = await warehouse.save();
        return res.status(200).json({ message: "Damage item updated successfully", status: true, warehouse: savedWarehouse });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal server error", status: false });
    }
};
export const deletedamageItem = async (req, res) => {
    try {
        const { warehouseId, damageItemId } = req.params;
        const warehouse = await Warehouse.findById(warehouseId);
        if (!warehouse) {
            return res.status(404).json({ message: "warehouse not found", status: false });
        }
        warehouse.damageItem = warehouse.damageItem.filter(sub => sub._id.toString() !== damageItemId);
        const updatedDamageItem = await warehouse.save();
        return res.status(200).json({ message: "damageItem deleted successfully", status: true, warehouse: updatedDamageItem });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
}
export const getDamageItems = async (req, res, next) => {
    try {
        const warehouseId = req.params.id;
        const warehouse = await Warehouse.findOne({ _id: warehouseId })
            .populate({ path: 'damageItem.productId', model: 'product' });
        if (!warehouse) {
            return res.status(404).json({ message: "Warehouse not found", status: false });
        }
        const damageItems = warehouse.damageItem;
        if (!damageItems || damageItems.length === 0) {
            return res.status(404).json({ message: "No damage items found", status: false });
        }
        const resultArray = damageItems.map(item => ({
            warehouse: {
                _id: warehouse._id,
                warehouseName: warehouse.warehouseName,
                // lastName: warehouse.lastName,
                typeStatus: warehouse.typeStatus
            },
            damageItem: {
                productId: {
                    _id: item.productId._id,
                    Product_Title: item.productId.Product_Title,
                },
                _id: item._id,
                unitType: item.unitType,
                transferQty: item.transferQty,
                Size: item.Size,
                currentStock: item.currentStock,
                price: item.price,
                totalPrice: item.totalPrice,
                demagePercentage: item.demagePercentage,
                reason: item.reason,
                typeStatus: item.typeStatus
            },
        }));

        return res.status(200).json({ damageItems: resultArray, status: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message, status: false });
    }
};

export const getShortItems = async (req, res, next) => {
    try {
        const warehouseId = req.params.id;
        const warehouse = await Warehouse.findOne({ _id: warehouseId })
            .populate({ path: 'shortItem.productId', model: 'product' });
        if (!warehouse) {
            return res.status(404).json({ message: "Warehouse not found", status: false });
        }
        const shortItem = warehouse.shortItem;
        if (!shortItem || shortItem.length === 0) {
            return res.status(404).json({ message: "No damage items found", status: false });
        }
        const resultArray = shortItem.map(item => ({
            warehouse: {
                _id: warehouse._id,
                warehouseName: warehouse.warehouseName,
                // lastName: warehouse.lastName,
                typeStatus: warehouse.typeStatus
            },
            shortItem: {
                productId: {
                    _id: item.productId._id,
                    Product_Title: item.productId.Product_Title,
                },
                _id: item._id,
                productId: item.productId,
                date: item.date,
                shortQty: item.qty,
                dateOfShortage: item.dateOfShortage,
                price: item.price,
                totalPrice: item.totalPrice,
                // demagePercentage: item.demagePercentage,
                // reason: item.reason,
                // typeStatus: item.typeStatus
            },
        }));

        return res.status(200).json({ shortItem: resultArray, status: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message, status: false });
    }
};
export const updateTypeStatus = async (req, res, next) => {
    try {
        const warehouseId = req.params.id;
        const newTypeStatus = req.body.typeStatus;
        const updatedWarehouse = await Warehouse.findOneAndUpdate({ _id: warehouseId });
        if (!updatedWarehouse) {
            return res.status(404).json({ message: "Warehouse not found", status: false });
        }
        const damageItem = updatedWarehouse.damageItem.find(item => item.productId.toString() === req.params.productId);
        if (damageItem) {
            damageItem.typeStatus = newTypeStatus || damageItem.typeStatus,
                damageItem.damagePercentage = req.body.damagePercentage || damageItem.damagePercentage,
                damageItem.reason = req.body.reason || damageItem.reason
            await updatedWarehouse.save();
        }
        return res.status(200).json({ warehouse: updatedWarehouse, status: true });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message, status: false });
    }
};
//--------------------------------------------------------------------------
export const ViewAllWarehouse1 = async () => {
    try {
        let array = []
        const ware = await Warehouse.find({}).sort({ sortorder: -1 }).select('_id');
        if (!ware) {

        }
        for (let id of ware) {
            let userData = await Warehouse.findById({ _id: id._id }).sort({ sortorder: -1 })
            const { _id, warehouseName, address, mobileNo, landlineNumber, productItems, damageItem, database } = userData
            const warehouse = {
                warehouseId: _id,
                warehouseName: warehouseName,
                mobileNumber: mobileNo,
                landlineNumber: landlineNumber,
                address: address,
                productItems: productItems,
                damageItem: damageItem,
                database: database,
                closingStatus: "closing"
            }
            if (warehouse) {
                const stock = await Stock.create(warehouse)
            }
        }
        await deleteModel()
    } catch (err) {
        console.error(err);
    }
};
export const viewStockClosingWarehouse = async (req, res, next) => {
    try {
        const warehouse = await Stock.find({ database: req.params.database }).sort({ date: 1, sortorder: -1 }).populate({ path: "productItems.productId", model: "product" });
        //.populate({ path: "warehouseId", model: "warehouse" })
        return (warehouse.length > 0) ? res.status(200).json({ Warehouse: warehouse, status: true }) : res.json({ message: "Not Found", status: false })
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
}

export const viewOpeningStockWarehouse = async (req, res, next) => {
    try {
        let opening = [];
        const currentDate = new Date();
        const warehouse = await Stock.find({}).sort({ sortorder: -1 }).populate({ path: "productItems.productId", model: "product" })
        for (let ware of warehouse) {
            ware.openingStatus = "opening";
            ware.Openingdate = currentDate;
            const openingWarehouse = await ware.save();
            opening.push(openingWarehouse);
        }
        return (opening.length > 0) ? res.status(200).json({ Warehouse: opening, status: true }) : res.status(404).json({ message: "Not Found", status: false })
    }
    catch (err) {
        console.log(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
}
// my code
export const ViewOverDueStock1 = async (req, res, next) => {
    try {
        const currentDate = moment();
        const startOfLastMonth = currentDate.clone().subtract(30, 'days');
        const productsNotOrderedLastMonth = await Product.find({
            status: "Active",
            createdAt: { $lt: startOfLastMonth.toDate() }
        });
        if (!productsNotOrderedLastMonth || productsNotOrderedLastMonth.length === 0) {
            return res.status(404).json({ message: "No products found", status: false });
        }
        const allOrderedProducts = await CreateOrder.find({ createdAt: { $gte: startOfLastMonth.toDate() } }).distinct('orderItems')
        let allProduct = [];
        for (let item of productsNotOrderedLastMonth) {
            const wasOrderedLastMonth = await allOrderedProducts.find(orderedItem => orderedItem.productId.toString() === item._id.toString());
            if (!wasOrderedLastMonth) {
                const warehouse = await Warehouse.findById(item.warehouse);
                if (warehouse) {
                    const qty = warehouse.productItems.find(item => item.productId.toString() === item._id.toString());
                    if (qty) {
                        let pro = {
                            item: item,
                            Qty: qty.currentStock
                        };
                        allProduct.push(pro);
                    } else {
                        allProduct.push(item);
                        console.error(`Product with ID ${item._id} not found in warehouse`);
                    }
                } else {
                    console.error(`Warehouse with ID ${item.warehouse} not found`);
                }
            }
        }
        return res.status(200).json({ allProduct, status: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};

export const ViewOverDueStock = async (req, res, next) => {
    try {
        const allProduct = []
        const currentDate = moment();
        const startOfLastMonth = currentDate.clone().subtract(30, 'days');
        const productsNotOrderedLastMonth = await Product.find({ database: req.params.database, status: "Active", createdAt: { $lt: startOfLastMonth.toDate() } }).populate({ path: "partyId", model: "customer" }).populate({ path: "warehouse", model: "warehouse" });
        if (!productsNotOrderedLastMonth || productsNotOrderedLastMonth.length === 0) {
            return res.status(404).json({ message: "No products found", status: false });
        }
        const orderedProductsLastMonth = await CreateOrder.find({
            database: req.params.database,
            createdAt: { $gte: startOfLastMonth.toDate() }
        }).distinct('orderItems');
        const orderedProductIdsLastMonth = orderedProductsLastMonth.map(orderItem => orderItem.productId.toString());
        const productsToProcess = productsNotOrderedLastMonth.filter(product =>
            !orderedProductIdsLastMonth.includes(product._id.toString()));
        for (let item of productsToProcess) {
            let partyId = "";
            let days = 0;
            const purchase = await PurchaseOrder.find({
                "orderItems.productId": item._id.toString()
            }).sort({ sortorder: -1 }).populate({ path: "partyId", model: "customer" });

            if (purchase.length > 0) {
                partyId = purchase[purchase.length - 1].partyId.CompanyName;
            }
            const lastDate = item.salesDate || item.createdAt;
            const lastOrderDate = new Date(lastDate);
            const currentDates = new Date();
            const timeDifference = currentDates - lastOrderDate;
            days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
            const products = {
                product: item,
                overDue: days,
            };
            allProduct.push(products);
        }
        return res.status(200).json({ allProduct, status: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};
export const ViewDeadParty = async (req, res, next) => {
    try {
        let days = 0
        const Parties = []
        const userId = req.params.id;
        const database = req.params.database;
        const currentDate = moment();
        const startOfLastMonth = currentDate.clone().subtract(30, 'days');

        const hierarchy = await Customer.find({
            database: database,
            status: 'Active',
            leadStatusCheck: "false",
            createdAt: { $lt: startOfLastMonth },
            created_by: { $nin: [null, ""] }
        })
            .populate({
                path: "created_by",
                model: "user",
                match: { _id: { $exists: true } }
            })
            .populate({
                path: "category",
                model: "customerGroup"
            });
        const allOrderedParties = await CreateOrder.find({ database: database, createdAt: { $gte: startOfLastMonth.toDate() } })
        let allParty = []
        let result = []
        for (let item of hierarchy) {
            const party = allOrderedParties.find((items) => items.partyId.toString() === item._id.toString())
            if (!party) {
                allParty.push(item)
            }
        }
        let lastDays = ""
        for (let id of allParty) {
            let purchaseDate = "";
            const purchase = await PurchaseOrder.find({ partyId: id._id.toString() }).sort({ sortorder: -1 }).populate({ path: "partyId", model: "customer" });
            if (purchase.length > 0) {
                purchaseDate = purchase[purchase.length - 1].createdAt;
                const lastDate = purchaseDate;
                const lastOrderDate = new Date(lastDate);
                const currentDates = new Date();
                const timeDifference = currentDates - lastOrderDate;
                days = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
            }
            const products = {
                Party: id,
                purchaseDate: purchaseDate,
                days: days
            };
            Parties.push(products);
            days = 0;
        }
        return res.status(200).json({ Parties: Parties, status: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};


export const OverDuePartyCounter = async (req, res) => {
    try {
        const database = req.params.database;
        const today = new Date();

        const customers = await Customer.find({
            database,
            status: "Active"
        }).select("_id OpeningBalance Type lockInTime");

        let overDueCount = 0;

        for (const customer of customers) {
            const partyId = customer._id;

            if (!partyId || !mongoose.Types.ObjectId.isValid(partyId)) continue;

            const ledgerRes = await Ledger.find({ partyId }).sort({ date: 1 });

            let totalDebit = 0;
            let totalCredit = 0;

            for (const entry of ledgerRes) {
                if (entry.debit) totalDebit += entry.debit;
                if (entry.credit) totalCredit += entry.credit;
            }

            const openingBalance = Number(customer.OpeningBalance) || 0;
            const openingType = customer.Type?.toLowerCase();

            if (openingBalance > 0) {
                if (openingType === "debit") totalDebit += openingBalance;
                else if (openingType === "credit") totalCredit += openingBalance;
            }

            const closingBalance = totalDebit - totalCredit;

            const { overDueDays } = await calculateDueAndOverdueDays(ledgerRes, customer.lockInTime || 0, closingBalance);

            if (overDueDays > 0) {
                overDueCount++;
            }
        }

        return res.status(200).json({
            status: true,
            count: overDueCount
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            status: false,
            message: "Internal Server Error"
        });
    }
};

async function calculateDueAndOverdueDays(ledgerRes, lockInTime, closing) {
    const today = new Date();

    if (closing < 0) return { dueDays: 0, overDueDays: 0 };

    const debits = [];
    const credits = [];

    if (Array.isArray(ledgerRes)) {
        ledgerRes.forEach(entry => {
            const entryDate = entry.date ? new Date(entry.date) : null;
            if (entry.debit && entryDate) debits.push({ amount: entry.debit, date: entryDate });
            if (entry.credit && entryDate) credits.push({ amount: entry.credit, date: entryDate });
        });
    }

    debits.sort((a, b) => a.date - b.date);
    credits.sort((a, b) => a.date - b.date);

    let unpaidDebits = [...debits];

    for (const credit of credits) {
        let creditAmount = credit.amount;
        while (creditAmount > 0 && unpaidDebits.length > 0) {
            const firstDebit = unpaidDebits[0];
            if (creditAmount >= firstDebit.amount) {
                creditAmount -= firstDebit.amount;
                unpaidDebits.shift();
            } else {
                firstDebit.amount -= creditAmount;
                creditAmount = 0;
            }
        }
    }

    if (unpaidDebits.length > 0) {
        const lastUnpaid = unpaidDebits[0];
        const dueDate = new Date(lastUnpaid.date);
        dueDate.setDate(dueDate.getDate() + lockInTime);

        const diff = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));
        const dueDays = diff > 0 ? diff : 0;
        const overDueDays = diff < 0 ? Math.abs(diff) : 0;
        return { dueDays, overDueDays };
    }

    return { dueDays: 0, overDueDays: 0 };
}




export const ViewDeadPartyCount = async (req, res, next) => {
    try {
        const database = req.params.database;
        const currentDate = moment();
        const startOfLastMonth = currentDate.clone().subtract(30, 'days');

        const hierarchy = await Customer.find({
            database: database,
            status: 'Active',
            leadStatusCheck: "false",
            createdAt: { $lt: startOfLastMonth },
            created_by: { $nin: [null, ""] }
        }).select("_id");

        const allOrderedParties = await CreateOrder.find({
            database: database,
            createdAt: { $gte: startOfLastMonth.toDate() }
        }).select("partyId");

        const orderedPartySet = new Set(
            allOrderedParties
                .filter(o => mongoose.Types.ObjectId.isValid(o.partyId))
                .map(o => o.partyId.toString())
        );

        let deadPartyCount = 0;

        for (let customer of hierarchy) {
            if (!orderedPartySet.has(customer._id.toString())) {
                deadPartyCount++;
            }
        }

        return res.status(200).json({
            count: deadPartyCount,
            status: true
        });

    } catch (err) {
        console.error(err);
        return res.status(500).json({
            error: "Internal Server Error",
            status: false
        });
    }
};


export const ViewDeadParty1 = async (req, res, next) => {
    try {
        const Parties = []
        const userId = req.params.id;
        const database = req.params.database;
        const currentDate = moment();
        const startOfLastMonth = currentDate.clone().subtract(30, 'days');
        const hierarchy = await Customer.find({ database: database, status: 'Active', leadStatusCheck: "false", createdAt: { $lt: startOfLastMonth } }).populate({ path: "created_by", model: "user" }).populate({ path: "category", model: "customerGroup" }).lean();
        const allOrderedParties = await CreateOrder.find({ database: database, createdAt: { $gte: startOfLastMonth.toDate() } }).lean();
        const receiptMap = {};
        for (let item of hierarchy) {
            let purchaseDate = "";
            const purchase = await PurchaseOrder.find({ partyId: item._id.toString() }).sort({ sortorder: -1 }).populate({ path: "partyId", model: "customer" });
            if (purchase.length > 0) {
                purchaseDate = purchase[purchase.length - 1].createdAt;
            }
            const products = {
                Party: item,
                purchaseDate: purchaseDate
            };

            Parties.push(products);
        }
        return res.status(200).json({ Parties: Parties, status: true });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Internal Server Error", status: false });
    }
};

export const partyHierarchy = async function partyHierarchy(userId, database, processedIds = new Set()) {
    try {
        if (processedIds.has(userId)) {
            return [];
        }
        processedIds.add(userId);
        const user = await User.findOne({ _id: userId, database: `${database}` }).lean();
        if (!user) {
            return [];
        }
        const createdByUserId = user.created_by;
        if (!createdByUserId) {
            return [user];
        }
        const parentResults = await partyHierarchy(createdByUserId, database, processedIds);
        return [user, ...parentResults];
    } catch (error) {
        console.error('Error in getCustomerHierarchy:', error);
        throw error;
    }
};
export const ViewAllWarehouse = async () => {
    try {
        let array = []
        const ware = await Warehouse.find({}).sort({ sortorder: -1 }).select('_id');
        if (!ware) {

        }
        for (let id of ware) {
            let userData = await Warehouse.findById({ _id: id._id }).sort({ sortorder: -1 }).populate({ path: "productItems.productId", model: "product" })
            const { _id, warehouseName, address, mobileNo, landlineNumber, productItems, damageItem, database } = userData
            const stocks = await ClosingStocks(id._id, productItems)
            const warehouse = {
                warehouseId: _id,
                warehouseName: warehouseName,
                mobileNumber: mobileNo,
                landlineNumber: landlineNumber,
                address: address,
                productItems: stocks,
                damageItem: damageItem,
                database: database,
                closingStatus: "closing"
            }
            if (warehouse) {
                const stock = await Stock.create(warehouse)
            }
        }
        await deleteModel()
    } catch (err) {
        console.error(err);
    }
};
export const ClosingStocks = async (warehouse, productItem) => {
    try {
        const gstDetails = [];
        let cgstRate = 0;
        let igstRate = 0;
        let tax = 0
        let pQty = 0;
        let pRate = 0;
        let pBAmount = 0
        let pTaxRate = 0
        let pTotal = 0
        let sQty = 0;
        let sRate = 0;
        let sBAmount = 0
        let sTaxRate = 0
        let sTotal = 0
        for (let item of productItem) {
            const stock = await ClosingStock.findOne({ warehouseId1: warehouse, productId: item.productId._id.toString() })
            if (stock) {
                pQty = stock.pQty || 0;
                pRate = stock.pRate || 0;
                pBAmount = stock.pBAmount || 0
                pTaxRate = stock.pTaxRate || 0
                pTotal = stock.pTotal || 0
                sQty = stock.sQty || 0;
                sRate = stock.sRate || 0;
                sBAmount = stock.sBAmount || 0
                sTaxRate = stock.sTaxRate || 0
                sTotal = stock.sTotal || 0
            }
            const rate = item.gstPercentage / 2;
            if (item.igstTaxType === false) {
                cgstRate = ((item.currentStock * item.price) * rate) / 100;
                tax = cgstRate * 2
            } else {
                igstRate = ((item.currentStock * item.price) * item.gstPercentage) / 100;
                tax = igstRate
            }
            const gst = {
                productId: item.productId._id.toString(),
                unitType: item.unitType,
                Size: item.Size,
                currentStock: item.currentStock,
                transferQty: item.transferQty,
                price: item.price,
                totalPrice: item.totalPrice,
                pendingStock: item.pendingStock,
                igstTaxType: item.igstTaxType,
                gstPercentage: item.gstPercentage,
                damageItem: item.damageItem,
                cQty: item.currentStock || 0,
                cRate: item.price || 0,
                cBAmount: item.totalPrice || 0,
                cTaxRate: tax || 0,
                cTotal: (item.totalPrice + tax) || 0,
                pQty: pQty || 0,
                pRate: pRate || 0,
                pBAmount: pBAmount || 0,
                pTaxRate: pTaxRate || 0,
                pTotal: pTotal || 0,
                sQty: sQty || 0,
                sRate: sRate || 0,
                sBAmount: sBAmount || 0,
                sTaxRate: sTaxRate || 0,
                sTotal: sTotal || 0

            };
            gstDetails.push(gst);
            pQty = 0;
            pRate = 0;
            pBAmount = 0
            pTaxRate = 0
            pTotal = 0
            sQty = 0;
            sRate = 0;
            sBAmount = 0
            sTaxRate = 0
            sTotal = 0
        }
        return gstDetails;
    }
    catch (err) {
        console.log(err)
    }
}
export const deleteModel = async () => {
    try {
        await ClosingStock.deleteMany({});
        return true
    } catch (error) {
        console.error('Error deleting data:', error);
    }
}
// InWard And OutWard
export const ClosingPurchase = async (orderItem, warehouse) => {
    try {
        let cgstRate = 0;
        let sgstRate = 0;
        let igstRate = 0;
        let tax = 0
        const rate = parseInt(orderItem.gstPercentage) / 2;
        if (orderItem.igstTaxType === false) {
            cgstRate = (((orderItem.transferQty) * orderItem.price) * rate) / 100;
            sgstRate = (((orderItem.transferQty) * orderItem.price) * rate) / 100;
            tax = cgstRate + sgstRate
        } else {
            igstRate = (((orderItem.transferQty) * orderItem.price) * parseInt(orderItem.gstPercentage)) / 100;
            tax = igstRate
        }
        const stock = await ClosingStock.findOne({ warehouseId1: warehouse, productId: orderItem.productId })
        if (stock) {
            stock.pQty += (orderItem.transferQty);
            stock.pRate += (orderItem.price);
            stock.pBAmount += orderItem.totalPrice;
            stock.pTaxRate += tax;
            stock.pTotal += (orderItem.totalPrice + tax)
            await stock.save()
        } else {
            const closing = ClosingStock({ warehouseId1: warehouse, productId: orderItem.productId, pQty: (orderItem.transferQty), pRate: orderItem.price, pBAmount: orderItem.totalPrice, pTaxRate: tax, pTotal: (orderItem.totalPrice + tax) })
            await closing.save()
        }
        return true
    }
    catch (err) {
        console.log(err)
    }
}
export const ClosingSales = async (orderItem, warehouse) => {
    try {
        let cgstRate = 0;
        let sgstRate = 0;
        let igstRate = 0;
        let tax = 0
        const rate = parseInt(orderItem.gstPercentage) / 2;
        if (orderItem.igstTaxType === false) {
            cgstRate = (((orderItem.transferQty) * orderItem.price) * rate) / 100;
            sgstRate = (((orderItem.transferQty) * orderItem.price) * rate) / 100;
            tax = cgstRate + sgstRate.sgstRate
        } else {
            igstRate = (((orderItem.transferQty) * orderItem.price) * parseInt(orderItem.gstPercentage)) / 100;
            tax = igstRate
        }
        const stock = await ClosingStock.findOne({ warehouseId1: warehouse, productId: orderItem.productId })
        if (stock) {
            stock.sQty += (orderItem.transferQty);
            stock.sRate += (orderItem.price);
            stock.sBAmount += orderItem.totalPrice;
            stock.sTaxRate += tax;
            stock.sTotal += (orderItem.totalPrice + tax)
            await stock.save()
        } else {
            const closing = ClosingStock({ warehouseId1: warehouse, productId: orderItem.productId, sQty: (orderItem.transferQty), sRate: orderItem.price, sBAmount: orderItem.totalPrice, sTaxRate: tax, sTotal: (orderItem.totalPrice + tax) })
            await closing.save()
        }
        return true
    }
    catch (err) {
        console.log(err)
    }
}

// export const stockReport = async (req, res, next) => {
//     try {
//         const { database } = req.params;
//         const purchaseOrders = await PurchaseOrder.find({ database, status: { $ne: "Deactive" } });
//         const salesOrders = await CreateOrder.find({ database, status: { $ne: "Deactive" } });
//        const productMap = {};
//         const allProductIds = new Set();
//         for (const po of purchaseOrders) {
//             const status = po.status || 'pending';
//             const totalTax = (status === 'completed')
//                 ? (po.coolieAndCartage || 0) +
//                   (po.labourCost || 0) +
//                   (po.localFreight || 0) +
//                   (po.miscellaneousCost || 0) +
//                   (po.transportationCost || 0)+
//                   (po.tax||0)
//                 : 0;
//             for (const item of po.orderItems) {
//                 const productId = item.productId?.toString();
//                 if (!productId) continue;

//                 allProductIds.add(productId);
//                 const qty = item.qty || 0;
//                 const totalPrice = item.totalPrice || 0;

//                 if (!productMap[productId]) {
//                     productMap[productId] = {
//                         productId,
//                         pQty: 0,
//                         purchasePendingQty: 0,
//                         sQty: 0,
//                         openingRate: 0,
//                         oQty: 0,
//                         Product_Title: "",
//                         HSN_Code: "",
//                         openingCombineTotal: 0,
//                         pTotalPrice: 0,
//                         avgPurchaseRate: 0,
//                         totalPurchaseData: 0,
//                         pendingStock: 0,
//                         pendingRate: 0,
//                         pendingStockTotal: 0,
//                         sRate: 0,
//                         sTotal: 0,
//                         closingQty: 0,
//                         closingAveRate: 0,
//                         closingTotal: 0,
//                         totalTax: 0
//                     };
//                 }

//                 const entry = productMap[productId];
//                 if (status === 'completed') {
//                     entry.pQty += qty;
//                     entry.pTotalPrice += totalPrice;
//                     entry.totalTax += totalTax;
//                     entry.totalPurchaseData += totalPrice + totalTax;
//                     // console.log("totalPurchaseData",entry,entry.totalTax,totalTax)
//                 } else {
//                     entry.purchasePendingQty += qty;
//                 }
//             }
//         }

//         for (const so of salesOrders) {
//             const status = so.status || 'pending';

//             for (const item of so.orderItems) {
//                 const productId = item.productId?.toString();
//                 if (!productId) continue;

//                 allProductIds.add(productId);
//                 const qty = item.qty || 0;
//                 const sTotal = item.totalPrice || 0;

//                 if (!productMap[productId]) {
//                     productMap[productId] = {
//                         productId,
//                         pQty: 0,
//                         purchasePendingQty: 0,
//                         sQty: 0,
//                         openingRate: 0,
//                         oQty: 0,
//                         Product_Title: "",
//                         HSN_Code: "",
//                         openingCombineTotal: 0,
//                         pTotalPrice: 0,
//                         avgPurchaseRate: 0,
//                         totalPurchaseData: 0,
//                         pendingStock: 0,
//                         pendingRate: 0,
//                         pendingStockTotal: 0,
//                         sRate: 0,
//                         sTotal: 0,
//                         closingQty: 0,
//                         closingAveRate: 0,
//                         closingTotal: 0,
//                         totalTax: 0
//                     };
//                 }

//                 const entry = productMap[productId];

//                 if (status === 'completed') {
//                     entry.sQty += qty;
//                     entry.sTotal += sTotal;
//                 } else {
//                     entry.pendingStock += qty;
//                     entry.pendingStockTotal += sTotal;
//                 }
//             }
//         }
//         const productList = await Product.find({ _id: { $in: Array.from(allProductIds) } });
//         for (const product of productList) {
//             const id = product._id.toString();
//             const entry = productMap[id];
//             if (entry) {
//                 entry.openingRate = product.openingRate || 0;
//                 entry.oQty = product.Opening_Stock || 0;
//                 entry.Product_Title = product.Product_Title || "";
//                 entry.HSN_Code = product.HSN_Code || "";

//                 entry.openingCombineTotal = entry.openingRate * entry.oQty;

//                 entry.avgPurchaseRate = entry.pQty > 0
//                     ? (entry.pTotalPrice + entry.totalTax) / entry.pQty
//                     : 0;

//                 entry.sRate = entry.sQty > 0
//                     ? entry.sTotal / entry.sQty
//                     : 0;

//                 entry.pendingRate = entry.pendingStockTotal + entry.pendingStock;

//                 entry.closingQty = entry.oQty + entry.pQty - entry.pendingStock - entry.sQty;
//                 const totalQty = entry.oQty + entry.pQty;
//                 entry.closingAveRate = totalQty > 0
//                     ? (entry.openingCombineTotal + entry.totalPurchaseData) / totalQty
//                     : 0;

//                 entry.closingTotal = entry.closingQty * entry.closingAveRate;
//             }
//         }

//         const stockReport = Object.values(productMap);
//         const totalSummary = stockReport.reduce((acc, item) => {
//             acc.Product_Title="Total";
//             acc.pQty += item.pQty || 0;
//             acc.purchasePendingQty += item.purchasePendingQty || 0;
//             acc.sQty += item.sQty || 0;
//             acc.oQty += item.oQty || 0;
//             acc.openingCombineTotal += item.openingCombineTotal || 0;
//             acc.pTotalPrice += item.pTotalPrice || 0;
//             acc.totalPurchaseData += item.totalPurchaseData || 0;
//             acc.pendingStock += item.pendingStock || 0;
//             acc.pendingStockTotal += item.pendingStockTotal || 0;
//             acc.pendingRate += item.pendingRate || 0;
//             acc.sTotal += item.sTotal || 0;
//             acc.closingQty += item.closingQty || 0;
//             acc.closingTotal += item.closingTotal || 0;
//             acc.totalTax += item.totalTax || 0;
//             return acc;
//         }, {
//             pQty: 0,
//             purchasePendingQty: 0,
//             sQty: 0,
//             oQty: 0,
//             openingCombineTotal: 0,
//             pTotalPrice: 0,
//             totalPurchaseData: 0,
//             pendingStock: 0,
//             pendingStockTotal: 0,
//             pendingRate: 0,
//             sTotal: 0,
//             closingQty: 0,
//             closingTotal: 0,
//             totalTax: 0
//         });

//         return res.status(200).json({
//             message: "Stock report generated successfully",
//             status: true,
//             data: stockReport,
//             totalSummary
//         });
//     } catch (error) {
//         console.error(error);
//         return res.status(500).json({
//             message: "Internal Server Error",
//             error: error.message,
//             status: false
//         });
//     }
// };


export const stockReport = async (req, res, next) => {
    try {
        const { database } = req.params;

        const purchaseOrders = await PurchaseOrder.find({ database, status: { $ne: "Deactive" } });
        const salesOrders = await CreateOrder.find({ database, status: { $ne: "Deactive" } });
        const productMap = {};
        const allProductIds = new Set();

        for (const po of purchaseOrders) {
            const status = po.status || 'pending';
            const totalTax = (status === 'completed')
                ? ((po.coolieAndCartage || 0) +
                    (po.labourCost || 0) +
                    (po.localFreight || 0) +
                    (po.miscellaneousCost || 0) +
                    (po.transportationCost || 0) +
                    (po.tax || 0)) / po.orderItems.length
                : 0;
            for (const item of po.orderItems) {
                const productId = item.productId?.toString();
                if (!productId) continue;

                allProductIds.add(productId);
                const qty = item.qty || 0;
                const totalPrice = item.totalPrice || 0;

                if (!productMap[productId]) {
                    productMap[productId] = {
                        productId,
                        pQty: 0,
                        purchasePendingQty: 0,
                        sQty: 0,
                        openingRate: 0,
                        oQty: 0,
                        Product_Title: "",
                        warehouseName: "",
                        GSTRate: 0,
                        HSN_Code: "",
                        openingCombineTotal: 0,
                        pTotalPrice: 0,
                        avgPurchaseRate: 0,
                        totalPurchaseData: 0,
                        pendingStock: 0,
                        pendingRate: 0,
                        pendingStockTotal: 0,
                        sRate: 0,
                        sTotal: 0,
                        closingQty: 0,
                        closingAveRate: 0,
                        closingTotal: 0,
                        totalTax: 0
                    };
                }

                const entry = productMap[productId];

                if (status === 'completed') {
                    entry.pQty += qty;
                    entry.pTotalPrice += totalPrice;
                    entry.totalTax += totalTax;
                    entry.totalPurchaseData += totalPrice + totalTax;
                } else {
                    entry.purchasePendingQty += qty;
                }
            }
        }
        for (const so of salesOrders) {
            const status = so.status || 'pending';

            for (const item of so.orderItems) {
                const productId = item.productId?.toString();
                if (!productId) continue;

                allProductIds.add(productId);
                const qty = item.qty || 0;
                const sTotal = item.totalPrice || 0;

                if (!productMap[productId]) {
                    productMap[productId] = {
                        productId,
                        pQty: 0,
                        purchasePendingQty: 0,
                        sQty: 0,
                        openingRate: 0,
                        oQty: 0,
                        Product_Title: "",
                        warehouseName: "",
                        GSTRate: 0,
                        HSN_Code: "",
                        openingCombineTotal: 0,
                        pTotalPrice: 0,
                        avgPurchaseRate: 0,
                        totalPurchaseData: 0,
                        pendingStock: 0,
                        pendingRate: 0,
                        pendingStockTotal: 0,
                        sRate: 0,
                        sTotal: 0,
                        closingQty: 0,
                        closingAveRate: 0,
                        closingTotal: 0,
                        totalTax: 0
                    };
                }

                const entry = productMap[productId];

                if (status === 'completed') {
                    entry.sQty += qty;
                    entry.sTotal += sTotal;
                } else {
                    entry.pendingStock += qty;
                    entry.pendingStockTotal += sTotal;
                }
            }
        }

        const productList = await Product.find({ database, status: "Active" }).populate({ path: "warehouse", model: "warehouse" });

        for (const product of productList) {
            const id = product._id.toString();

            if (!productMap[id]) {
                productMap[id] = {
                    productId: id,
                    pQty: 0,
                    purchasePendingQty: 0,
                    sQty: 0,
                    openingRate: 0,
                    oQty: 0,
                    Product_Title: "",
                    warehouseName: "",
                    GSTRate: 0,
                    HSN_Code: "",
                    openingCombineTotal: 0,
                    pTotalPrice: 0,
                    avgPurchaseRate: 0,
                    totalPurchaseData: 0,
                    pendingStock: 0,
                    pendingRate: 0,
                    pendingStockTotal: 0,
                    sRate: 0,
                    sTotal: 0,
                    closingQty: 0,
                    closingAveRate: 0,
                    closingTotal: 0,
                    totalTax: 0
                };
            }

            const entry = productMap[id];

            entry.openingRate = product.openingRate || 0;
            entry.oQty = product.Opening_Stock || 0;
            entry.Product_Title = product.Product_Title || "";
            entry.warehouseName = product.warehouse?.warehouseName;
            entry.GSTRate = product.GSTRate;
            entry.HSN_Code = product.HSN_Code || "";
            entry.openingCombineTotal = entry.openingRate * entry.oQty;

            const totalQty = entry.oQty + entry.pQty;

            entry.avgPurchaseRate = entry.pQty > 0
                ? (entry.pTotalPrice + entry.totalTax) / entry.pQty
                : 0;

            entry.sRate = entry.sQty > 0
                ? entry.sTotal / entry.sQty
                : 0;

            entry.pendingRate = entry.pendingStockTotal + entry.pendingStock;

            entry.closingQty = entry.oQty + entry.pQty - entry.pendingStock - entry.sQty;

            entry.closingAveRate = totalQty > 0
                ? (entry.openingCombineTotal + entry.totalPurchaseData) / totalQty
                : 0;

            entry.closingTotal = entry.closingQty * entry.closingAveRate;
        }
        const stockReport = Object.values(productMap);

        const totalSummary = stockReport.reduce((acc, item) => {
            acc.Product_Title = "Total";
            acc.pQty += item.pQty || 0;
            acc.purchasePendingQty += item.purchasePendingQty || 0;
            acc.sQty += item.sQty || 0;
            acc.oQty += item.oQty || 0;
            acc.openingCombineTotal += item.openingCombineTotal || 0;
            acc.pTotalPrice += item.pTotalPrice || 0;
            acc.totalPurchaseData += item.totalPurchaseData || 0;
            acc.pendingStock += item.pendingStock || 0;
            acc.pendingStockTotal += item.pendingStockTotal || 0;
            acc.pendingRate += item.pendingRate || 0;
            acc.sTotal += item.sTotal || 0;
            acc.closingQty += item.closingQty || 0;
            acc.closingTotal += item.closingTotal || 0;
            acc.totalTax += item.totalTax || 0;
            return acc;
        }, {
            pQty: 0,
            purchasePendingQty: 0,
            sQty: 0,
            oQty: 0,
            openingCombineTotal: 0,
            pTotalPrice: 0,
            totalPurchaseData: 0,
            pendingStock: 0,
            pendingStockTotal: 0,
            pendingRate: 0,
            sTotal: 0,
            closingQty: 0,
            closingTotal: 0,
            totalTax: 0
        });

        return res.status(200).json({
            message: "Stock report generated successfully",
            status: true,
            data: stockReport,
            totalSummary
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
            status: false
        });
    }
};

export const InvertReport = async (req, res, next) => {
    try {
        const { database } = req.params;

        const purchaseOrders = await PurchaseOrder.find({
            database,
            status: "completed"
        })
            .populate({ path: "partyId", model: "customer" })
            .populate({ path: "orderItems.productId", model: "product" });

        let result = [];
        let sno = 1;

        for (let item of purchaseOrders) {
            for (let order of item.orderItems) {
                const totalTax = ((item.coolieAndCartage || 0) +
                    (item.labourCost || 0) +
                    (item.localFreight || 0) +
                    (item.miscellaneousCost || 0) +
                    (item.transportationCost || 0) +
                    (item.tax || 0)) / item.orderItems.length;
                const qty = order?.qty || 0;
                const totalprice = order?.totalPrice || 0;
                const total = totalprice + totalTax;

                result.push({
                    sno: sno++,
                    party: item?.partyId?.CompanyName,
                    Product_Title: order?.productId?.Product_Title,
                    HSN_Code: order?.productId?.HSN_Code,
                    qty: qty,
                    total: total,
                    date: item?.date,
                    Purchase_Rate: total / qty,
                    GSTRate: order?.productId?.GSTRate,
                });
            }
        }

        return res.status(200).json({
            message: "Data fetched successfully",
            status: true,
            data: result
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
            status: false
        });
    }
};


export const OutwordReport = async (req, res, next) => {
    try {
        const { database } = req.params;

        const salesOrders = await CreateOrder.find({
            database,
            status: "completed"
        })
            .populate({ path: "partyId", model: "customer" })
            .populate({ path: "orderItems.productId", model: "product" });

        let result = [];
        let sno = 1;

        for (let item of salesOrders) {
            for (let order of item.orderItems) {

                const qty = order?.qty || 0;
                const total = order?.totalPrice || 0;

                result.push({
                    sno: sno++,
                    party: item?.partyId?.CompanyName,
                    Product_Title: order?.productId?.Product_Title,
                    HSN_Code: order?.productId?.HSN_Code,
                    qty: qty,
                    total: total,
                    date: item?.date,
                    SalesRate: total / qty,
                    GSTRate: order?.productId?.GSTRate,
                });
            }
        }

        return res.status(200).json({
            message: "Data fetched successfully",
            status: true,
            data: result
        });

    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: "Internal Server Error",
            error: error.message,
            status: false
        });
    }
};


export const dashboardStockReport = async (req, res) => {
    try {
        const { database } = req.params;

        const purchaseOrders = await PurchaseOrder.find({ database, status: { $ne: "Deactive" } });
        const salesOrders = await CreateOrder.find({ database, status: { $ne: "Deactive" } });
        const productMap = {};

        for (const po of purchaseOrders) {
            const isCompleted = po.status === "completed";

            const taxPerItem = isCompleted
                ? (
                    (po.coolieAndCartage || 0) +
                    (po.labourCost || 0) +
                    (po.localFreight || 0) +
                    (po.miscellaneousCost || 0) +
                    (po.transportationCost || 0) +
                    (po.tax || 0)
                ) / po.orderItems.length
                : 0;

            for (const item of po.orderItems) {
                const id = item.productId?.toString();
                if (!id) continue;

                if (!productMap[id]) {
                    productMap[id] = { pQty: 0, pTotal: 0, totalTax: 0, sQty: 0 };
                }

                if (isCompleted) {
                    productMap[id].pQty += item.qty || 0;
                    productMap[id].pTotal += item.totalPrice || 0;
                    productMap[id].totalTax += taxPerItem;
                }
            }
        }

        for (const so of salesOrders) {
            const isCompleted = so.status === "completed";

            for (const item of so.orderItems) {
                const id = item.productId?.toString();
                if (!id) continue;

                if (!productMap[id]) {
                    productMap[id] = { pQty: 0, pTotal: 0, totalTax: 0, sQty: 0 };
                }

                if (isCompleted) {
                    productMap[id].sQty += item.qty || 0;
                }
            }
        }

        const products = await Product.find({ database, status: "Active" });

        const results = [];
        let grandClosingTotal = 0;

        for (const p of products) {
            const id = p._id.toString();
            const entry = productMap[id] || { pQty: 0, pTotal: 0, totalTax: 0, sQty: 0 };

            const oQty = p.Opening_Stock || 0;
            const openingRate = p.openingRate || 0;

            const openingTotal = oQty * openingRate;

            const totalQty = oQty + entry.pQty;

            const closingQty = oQty + entry.pQty - entry.sQty;

            const closingAveRate = totalQty > 0
                ? (openingTotal + (entry.pTotal + entry.totalTax)) / totalQty
                : 0;

            const closingTotal = closingQty * closingAveRate;

            grandClosingTotal += closingTotal;

            results.push({
                productId: id,
                Product_Title: p.Product_Title,
                closingQty,
                closingAveRate,
                closingTotal
            });
        }

        return res.status(200).json({
            status: true,
            message: "Stock closing report generated",
            // data: results,
            grandClosingTotal
        });

    } catch (err) {
        return res.status(500).json({
            status: false,
            message: "Internal Server Error",
            error: err.message
        });
    }
};

