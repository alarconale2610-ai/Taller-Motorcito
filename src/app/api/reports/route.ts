import { NextRequest, NextResponse } from 'next/server';
import { generateCompleteReport } from '@/lib/excel-reports';
import { createClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const branchId = searchParams.get('branchId');
    
    if (!branchId) {
      return NextResponse.json({ error: 'Branch ID requerido' }, { status: 400 });
    }

    // Verificar autenticación
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Generar el Excel completo
    const blob = await generateCompleteReport(branchId);
    const buffer = await blob.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Reporte_Completo_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });
  } catch (error) {
    console.error('Error generando reporte:', error);
    return NextResponse.json(
      { error: 'Error al generar el reporte' }, 
      { status: 500 }
    );
  }
}