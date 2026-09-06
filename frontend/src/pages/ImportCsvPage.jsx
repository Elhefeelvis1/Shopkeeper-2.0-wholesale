import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Papa from 'papaparse';
import { Upload, FileText, CheckCircle2, AlertCircle, Database, LayoutGrid, ArrowRight, ArrowLeft } from 'lucide-react';
import { useToast } from '../context/ToastContext';

const allowedTables = [
  { id: 'all_stocks', name: 'Stocks / Inventory' },
  { id: 'customers', name: 'Customers' },
  { id: 'suppliers', name: 'Suppliers' },
  { id: 'categories', name: 'Categories' },
  { id: 'units', name: 'Units' },
  { id: 'companies', name: 'Companies' }
];

const ImportCsvPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [step, setStep] = useState(1);

  // Step 1 State: File
  const [file, setFile] = useState(null);
  const [csvHeaders, setCsvHeaders] = useState([]);
  const [csvData, setCsvData] = useState([]);
  const [parsing, setParsing] = useState(false);

  // Step 2 State: Table & Schema
  const [selectedTable, setSelectedTable] = useState(searchParams.get('table') || '');
  const [schema, setSchema] = useState([]);
  const [fetchingSchema, setFetchingSchema] = useState(false);

  // Step 3 State: Mapping
  const [mappings, setMappings] = useState({}); // { dbColumn: csvHeader }

  // Step 4 State: Import
  const [importing, setImporting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);

  const fileInputRef = useRef(null);

  // Handle File Drop / Select
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith('.csv')) {
        showToast('error', 'Please select a valid CSV file.');
        return;
      }
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = (fileToParse) => {
    setParsing(true);
    Papa.parse(fileToParse, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.meta.fields && results.meta.fields.length > 0) {
          setCsvHeaders(results.meta.fields);
          setCsvData(results.data);
          setStep(2);
        } else {
          showToast('error', 'Could not extract headers from CSV.');
        }
        setParsing(false);
      },
      error: (error) => {
        showToast('error', `Error parsing CSV: ${error.message}`);
        setParsing(false);
      }
    });
  };

  // Fetch Schema when moving to Step 3
  const proceedToMapping = async () => {
    if (!selectedTable) {
      showToast('error', 'Please select a destination table.');
      return;
    }
    
    setFetchingSchema(true);
    try {
      const res = await axios.get(`/api/schema/${selectedTable}`);
      if (res.data.success) {
        const fetchedSchema = res.data.schema;
        setSchema(fetchedSchema);
        
        // Auto-match logic
        const initialMappings = {};
        fetchedSchema.forEach(col => {
          const matchedHeader = csvHeaders.find(
            header => header.toLowerCase().replace(/[^a-z0-9]/g, '') === col.column_name.toLowerCase().replace(/[^a-z0-9]/g, '')
          );
          if (matchedHeader) {
            initialMappings[col.column_name] = matchedHeader;
          } else {
            initialMappings[col.column_name] = '';
          }
        });
        setMappings(initialMappings);
        setStep(3);
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Failed to fetch table schema');
    } finally {
      setFetchingSchema(false);
    }
  };

  // Confirm mapping and move to Step 4
  const proceedToReview = () => {
    // Validate that all NOT NULL columns without default values are mapped
    const missingRequired = schema.filter(col => 
      col.is_nullable === 'NO' && !col.column_default && !mappings[col.column_name]
    );

    if (missingRequired.length > 0) {
      const missingNames = missingRequired.map(col => col.column_name).join(', ');
      showToast('error', `Please map the following required columns: ${missingNames}`);
      return;
    }

    setStep(4);
  };

  // Execute Import
  const executeImport = async () => {
    setValidating(true);
    // Brief UX delay for validation state visibility
    await new Promise(resolve => setTimeout(resolve, 800)); 

    if (selectedTable === 'all_stocks') {
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i];
        const qtyCol = mappings['quantity'];
        const quantity = qtyCol ? parseFloat(row[qtyCol]) : 0;
        
        if (quantity > 0) {
            const expiryCol = mappings['expiry_date'];
            const costCol = mappings['cost_per_unit'];
            
            if (!costCol || !row[costCol]) {
                setValidating(false);
                showToast('error', `Validation Failed: Row ${i + 1} has quantity > 0 but is missing a cost per unit.`);
                return;
            }

            if (expiryCol && row[expiryCol] && String(row[expiryCol]).trim() !== '') {
                const expiryDate = new Date(row[expiryCol]);
                const currentDate = new Date();
                currentDate.setHours(0, 0, 0, 0);

                if (expiryDate < currentDate) {
                    setValidating(false);
                    const itemName = mappings['name'] ? row[mappings['name']] : 'Unknown Item';
                    showToast('error', `Validation Failed: Item "${itemName}" on row ${i + 1} has an expiry date in the past.`);
                    return;
                }
            }
        }
      }
    }
    
    setValidating(false);
    setImporting(true);
    try {
      const payload = {
        tableName: selectedTable,
        mappings,
        data: csvData
      };
      
      const endpoint = selectedTable === 'all_stocks' ? '/api/import/stocks' : '/api/import';
      const res = await axios.post(endpoint, payload);
      
      if (res.data.success) {
        showToast('success', res.data.message);
        setImportSuccess(true);
      }
    } catch (err) {
      showToast('error', err.response?.data?.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); };
  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        setFile(droppedFile);
        parseFile(droppedFile);
      } else {
        showToast('error', 'Please drop a valid CSV file.');
      }
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-fade-in pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Import CSV Data</h1>
        <p className="text-sm text-gray-500 mt-0.5">Upload and map your data into the system.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between relative before:absolute before:inset-0 before:top-1/2 before:-translate-y-1/2 before:h-0.5 before:bg-gray-200 before:z-0">
        {[
          { num: 1, label: 'Upload' },
          { num: 2, label: 'Destination' },
          { num: 3, label: 'Mapping' },
          { num: 4, label: 'Review' }
        ].map(s => (
          <div key={s.num} className="relative z-10 flex flex-col items-center gap-1.5 sm:gap-2">
            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-colors ${
              step >= s.num ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 border-2 border-gray-200'
            }`}>
              {step > s.num || (step === 4 && importSuccess) ? <CheckCircle2 size={16} className="sm:w-5 sm:h-5" /> : s.num}
            </div>
            <span className={`text-xs sm:text-sm font-medium ${step >= s.num ? 'text-indigo-900 font-semibold' : 'text-gray-400'}`}>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-8 min-h-[350px]">
        {/* Step 1: Upload */}
        {step === 1 && (
          <div className="flex flex-col items-center justify-center h-full space-y-6 py-8 sm:py-12">
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className="w-full max-w-lg border-2 border-dashed border-indigo-200 bg-indigo-50/50 hover:bg-indigo-50 rounded-2xl p-6 sm:p-12 flex flex-col items-center text-center cursor-pointer transition-colors"
            >
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
              />
              <Upload size={40} className="sm:w-12 sm:h-12 text-indigo-500 mb-4" />
              <h3 className="text-base sm:text-lg font-bold text-gray-900">Click to upload or drag and drop</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">Only CSV files are supported</p>
              {parsing && <p className="text-indigo-600 mt-4 font-medium animate-pulse text-sm">Parsing CSV...</p>}
            </div>
          </div>
        )}

        {/* Step 2: Destination Setup */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in max-w-lg mx-auto py-8">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Database size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Select Destination</h2>
              <p className="text-gray-500 mt-2">Where should this data be imported to?</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Target Table</label>
              <select
                value={selectedTable}
                onChange={(e) => setSelectedTable(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
              >
                <option value="" disabled>Select a table...</option>
                {allowedTables.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.id})</option>
                ))}
              </select>
            </div>

            <div className="flex justify-between pt-8 border-t border-gray-100">
              <button onClick={() => setStep(1)} className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition flex items-center gap-2 cursor-pointer">
                <ArrowLeft size={18} /> Back
              </button>
              <button 
                onClick={proceedToMapping} 
                disabled={!selectedTable || fetchingSchema}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              >
                {fetchingSchema ? 'Loading Schema...' : 'Next Step'} <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Column Mapping */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <LayoutGrid className="text-indigo-600" /> Map Columns
                </h2>
                <p className="text-gray-500 mt-1">Match your CSV headers to the database columns.</p>
              </div>
              <div className="text-sm bg-blue-50 text-blue-700 px-4 py-2 rounded-lg border border-blue-100 flex items-center gap-2">
                <FileText size={16} /> Found {csvHeaders.length} columns in CSV
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-6 py-4 font-semibold text-gray-700 w-1/2">Database Column</th>
                    <th className="px-6 py-4 font-semibold text-gray-700 w-1/2">CSV Header</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {schema.map(col => {
                    const isRequired = col.is_nullable === 'NO' && !col.column_default;
                    return (
                      <tr key={col.column_name} className="bg-white">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-900">{col.column_name}</span>
                            {isRequired ? (
                              <span className="text-[10px] uppercase tracking-wider font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded">Required</span>
                            ) : (
                              <span className="text-[10px] uppercase tracking-wider font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded">Optional</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Type: {col.data_type}</p>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={mappings[col.column_name] || ''}
                            onChange={(e) => setMappings({ ...mappings, [col.column_name]: e.target.value })}
                            className={`w-full px-3 py-2 bg-white border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm transition-colors ${
                              isRequired && !mappings[col.column_name] ? 'border-red-300 bg-red-50' : 'border-gray-200'
                            }`}
                          >
                            <option value="">-- Do not import --</option>
                            {csvHeaders.map(h => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between pt-6">
              <button onClick={() => setStep(2)} className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition flex items-center gap-2 cursor-pointer">
                <ArrowLeft size={18} /> Back
              </button>
              <button 
                onClick={proceedToReview} 
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-2 cursor-pointer"
              >
                Review Import <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Review & Import */}
        {step === 4 && (
          <div className="space-y-8 animate-fade-in max-w-2xl mx-auto py-8 text-center">
            {importSuccess ? (
              <div className="space-y-6">
                <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={48} />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">Import Successful!</h2>
                <p className="text-gray-500 text-lg">Your data has been successfully imported into the system.</p>
                <div className="pt-8">
                  <button 
                    onClick={() => navigate('/home')} 
                    className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition shadow-sm cursor-pointer"
                  >
                    Return Home
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="w-20 h-20 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Database size={40} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Ready to Import</h2>
                
                <div className="bg-gray-50 rounded-xl p-6 border border-gray-100 text-left space-y-4">
                  <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                    <span className="text-gray-500 font-medium">Destination Table</span>
                    <span className="text-gray-900 font-bold bg-white px-3 py-1 rounded-md shadow-sm border border-gray-200">{selectedTable}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-gray-200 pb-4">
                    <span className="text-gray-500 font-medium">Rows to Import</span>
                    <span className="text-indigo-600 font-bold text-xl">{csvData.length}</span>
                  </div>
                  <div className="flex justify-between items-start pt-2">
                    <span className="text-gray-500 font-medium">Mapped Columns</span>
                    <div className="text-right max-w-[60%]">
                      {Object.entries(mappings).filter(([k,v]) => v).map(([dbCol, csvCol]) => (
                        <div key={dbCol} className="text-sm mb-1">
                          <span className="text-gray-900 font-medium">{dbCol}</span> <span className="text-gray-400 text-xs mx-1">←</span> <span className="text-gray-600 bg-white px-1.5 py-0.5 rounded border border-gray-200 text-xs">{csvCol}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-8">
                  <button onClick={() => setStep(3)} disabled={importing} className="px-6 py-2.5 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed">
                    <ArrowLeft size={18} /> Back
                  </button>
                  <button 
                    onClick={executeImport} 
                    disabled={importing || validating}
                    className="px-8 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition shadow-md flex items-center gap-2 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    {validating ? (
                      <>Validating CSV <div className="animate-pulse flex space-x-1 ml-1"><div className="h-1.5 w-1.5 bg-white rounded-full"></div><div className="h-1.5 w-1.5 bg-white rounded-full"></div><div className="h-1.5 w-1.5 bg-white rounded-full"></div></div></>
                    ) : importing ? (
                      <>Processing <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div></>
                    ) : (
                      <>Confirm & Import</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportCsvPage;
