import React from 'react';
import { createPortal } from 'react-dom';

const Receipt = ({ receiptData }) => {
  if (!receiptData) return null;

  const { shopDetails, date, items, totalAmount, totalDiscount, amountPaid, payRoute, salesRep } = receiptData;

  const content = (
    <div id="receipt-container" className="hidden print:block w-[300px] text-black bg-white p-4 font-mono text-sm leading-tight mx-auto absolute top-0 left-0 z-[9999]">
      <div className="text-center mb-4">
        {shopDetails?.shopLogo && shopDetails.shopLogo !== 'https://example.com/logo.png' && (
          <img src={shopDetails.shopLogo} alt="Logo" className="w-16 mx-auto mb-2 grayscale" />
        )}
        <h2 className="text-xl font-bold uppercase tracking-wider">{shopDetails?.shopName || 'Shop Name'}</h2>
        {receiptData.isReprint && <p className="text-sm font-bold uppercase tracking-wider mt-1 border-y border-black">*** REPRINT ***</p>}
        <p className="text-xs mt-1">{shopDetails?.shopAddress || 'Shop Address'}</p>
        <p className="text-xs">Tel: {shopDetails?.shopPhone || 'Phone'}</p>
      </div>

      <div className="border-t border-b border-dashed border-black py-2 mb-4 space-y-1 text-xs">
        <div className="flex justify-between">
          <span>Date:</span>
          <span>{date}</span>
        </div>
        <div className="flex justify-between">
          <span>Cashier:</span>
          <span>{salesRep || 'Admin'}</span>
        </div>
        <div className="flex justify-between">
          <span>Payment:</span>
          <span>{payRoute || 'Cash'}</span>
        </div>
      </div>

      <div className="mb-4">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-dashed border-black">
              <th className="py-1">Item</th>
              <th className="py-1 text-center">Qty</th>
              <th className="py-1 text-right">Amt</th>
            </tr>
          </thead>
          <tbody>
            {items?.map((item, idx) => {
              const itemPrice = parseFloat(item.sellPrice || item.selling_price || 0);
              const qty = parseFloat(item.quantity || 0);
              return (
                <tr key={idx}>
                  <td className="py-1 pr-1 break-words max-w-[140px] align-top">{item.itemName || item.item_name || 'Item'}</td>
                  <td className="py-1 text-center whitespace-nowrap align-top">{qty} x {itemPrice.toFixed(2)}</td>
                  <td className="py-1 text-right align-top">{(itemPrice * qty).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="border-t border-dashed border-black pt-2 space-y-1 mb-6 text-xs">
        <div className="flex justify-between">
          <span>Total:</span>
          <span>₦{totalAmount?.toFixed(2)}</span>
        </div>
        {totalDiscount > 0 && (
          <div className="flex justify-between">
            <span>Discount:</span>
            <span>-₦{totalDiscount?.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-sm mt-1">
          <span>Paid:</span>
          <span>₦{amountPaid?.toFixed(2)}</span>
        </div>
      </div>

      <div className="text-center text-xs space-y-1">
        <p className="font-bold">Thank you for your patronage!</p>
        <p className='mt-3'>-- Developed By Elvis 08149476348 --</p>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};

export default Receipt;
