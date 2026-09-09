import React from 'react';
import { createPortal } from 'react-dom';

const WholesaleReceipt = ({ receiptData }) => {
  if (!receiptData) return null;

  const { 
    shopDetails, 
    date, 
    items, 
    totalAmount, 
    totalDiscount, 
    amountPaid, 
    payRoute, 
    salesRep,
    customerName 
  } = receiptData;

  const content = (
    <div id="receipt-container" className="hidden print:block w-[300px] text-black bg-white p-4 font-mono text-sm leading-tight mx-auto absolute top-0 left-0 z-[9999]">
      <div className="text-center mb-3">
        {shopDetails?.shopLogo && shopDetails.shopLogo !== 'https://example.com/logo.png' && (
          <img src={shopDetails.shopLogo} alt="Logo" className="w-16 mx-auto mb-2 grayscale" />
        )}
        <h2 className="text-xl font-bold uppercase tracking-wider">{shopDetails?.shopName || 'Shop Name'}</h2>
        <p className="text-xs font-bold uppercase tracking-widest mt-1 py-0.5 border-y-2 border-black bg-gray-100">
          *** WHOLESALE INVOICE ***
        </p>
        <p className="text-xs mt-1">{shopDetails?.shopAddress || 'Shop Address'}</p>
        <p className="text-xs">Tel: {shopDetails?.shopPhone || 'Phone'}</p>
      </div>

      <div className="border-t border-b border-dashed border-black py-2 mb-3 space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{date}</span>
        </div>
        {customerName && (
          <div className="flex justify-between font-semibold">
            <span>Customer:</span>
            <span>{customerName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Sales Rep:</span>
          <span>{salesRep || 'Admin'}</span>
        </div>
        <div className="flex justify-between">
          <span>Payment:</span>
          <span>{payRoute || 'Cash'}</span>
        </div>
      </div>

      <div className="mb-3">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-dashed border-black">
              <th className="py-1">Item / Unit Specs</th>
              <th className="py-1 text-center">Qty</th>
              <th className="py-1 text-right">Amt (₦)</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, idx) => {
              const packPrice = parseFloat(item.wholesalePrice || item.sellPrice || item.selling_price || 0);
              const qty = Number(item.quantity || 0);
              const multiplier = Number(item.unitMultiplier || item.wholesale_multiplier || 1);
              const unitName = item.wholesaleUnit || item.wholesale_unit || 'Pack';
              const baseUnitName = item.unit_name || item.unit || 'units';
              const totalBaseUnits = qty * multiplier;

              return (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-1 pr-1 break-words max-w-[150px] align-top">
                    <div className="font-semibold">{item.itemName || item.item_name || 'Item'}</div>
                    <div className="text-[10px] text-gray-600">
                      {multiplier > 1 ? `(1 ${unitName} = ${multiplier} ${baseUnitName})` : ''}
                    </div>
                  </td>
                  <td className="py-1 text-center whitespace-nowrap align-top">
                    <div>{qty} {unitName}{qty > 1 ? 's' : ''}</div>
                    <div className="text-[10px] text-gray-600">({totalBaseUnits} {baseUnitName})</div>
                  </td>
                  <td className="py-1 text-right align-top">
                    <div>{(packPrice * qty).toFixed(2)}</div>
                    <div className="text-[10px] text-gray-600">@{packPrice.toFixed(2)}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t-2 border-dashed border-black pt-2 space-y-1 mb-5 text-xs">
        <div className="flex justify-between">
          <span>Gross Total:</span>
          <span>₦{totalAmount?.toFixed(2)}</span>
        </div>
        {totalDiscount > 0 && (
          <div className="flex justify-between text-red-600">
            <span>Discount Applied:</span>
            <span>-₦{totalDiscount?.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm mt-1 border-t border-black pt-1">
          <span>Amount Payable:</span>
          <span>₦{amountPaid?.toFixed(2)}</span>
        </div>
      </div>

      <div className="text-center text-xs space-y-1">
        <p className="font-bold uppercase tracking-wider">Bulk Goods Received In Good Condition</p>
        <p className="text-[11px]">Thank you for your bulk patronage!</p>
        <p className='mt-2 text-[10px] text-gray-500'>-- Developed By Elvis 08149476348 --</p>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default WholesaleReceipt;
