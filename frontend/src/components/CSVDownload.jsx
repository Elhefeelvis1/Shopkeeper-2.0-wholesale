import { CSVLink } from 'react-csv';
import { FileText } from 'lucide-react';


const CSVDownload = ({ fetchData, fileName }) => {
    return (
        <CSVLink
            data={fetchData}
            filename={fileName}
            className='bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition flex items-center gap-2'
        >
            <FileText size={18} />
            Export CSV
        </CSVLink>
    )
}

export default CSVDownload;